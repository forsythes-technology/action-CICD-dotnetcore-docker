import * as core from "@actions/core";
import { exec } from "@actions/exec";
import * as github from "@actions/github";
import { sendTeamsNotification } from "./sendNotification";

async function main() {
	try {

		const createReleaseInput: string = core.getInput("CREATE_RELEASE", { required: true });
		const octopusUrl: string = core.getInput("OCTOPUS_URL", { required: false });
		const octopusApiKey: string = core.getInput("OCTOPUS_APIKEY", { required: false });
		const msTeamsWebhook: string = core.getInput("MS_TEAMS_WEBHOOK", { required: false });
		const dbupProject: string = core.getInput("DBUP_PROJECT", { required: false });
		const dockerProject: string = core.getInput("DOCKER_PROJECT", { required: true });
		const registryHost: string = core.getInput("REGISTRY_HOST", { required: true });
		const registryUsername: string = core.getInput("REGISTRY_USERNAME", { required: true });
		const registryPassword: string = core.getInput("REGISTRY_PASSWORD", { required: true });
		let targetPlatform: string = core.getInput("TARGET_PLATFORM", { required: false });
		const context = github.context;
		const repoName = context.repo.repo;
		const createRelease = (createReleaseInput.toLowerCase() === "true");
		if (!targetPlatform) targetPlatform = "win-x64";
		if (createRelease && (!octopusUrl || !octopusApiKey)) {
			throw new Error("Cannot create a release without OCTOPUS_URL and OCTOPUS_APIKEY being defined");
		}
		if (createRelease && (!dockerProject || !registryHost || !registryUsername || !registryPassword)) {
			throw new Error("Cannot push to docker registry without DOCKER_PROJECT, REGISTRY_HOST, REGISTRY_USERNAME and REGISTRY_PASSWORD being defined");
		}
		core.info(`Building solution (ref: ${context.ref})...`);
		core.info("Build...");
		await exec(`dotnet build`);
		core.info("Test...");
		await exec(`dotnet test`);
		core.info("Publish...");
		await exec(`dotnet publish -r ${targetPlatform} -p:PublishDir=output -c Release`);
		if (createRelease) { // Build, pack and release
			if (context.ref.indexOf("refs/tags/") === -1) {
				throw new Error("Unable to get a version number");
			}
			const version = context.ref.replace("refs/tags/", "");
			core.info(`🐙 Deploying project ${repoName} (Version ${version}) to Octopus `);
			core.info("Installing octopus cli...");
			await exec(`dotnet tool install Octopus.DotNet.Cli --global`);
			// generate a package for each project and push to Octopus
			if (dbupProject) {
				core.info(`Deploying DbUp project: ${dbupProject}`);
				await exec(`dotnet octo pack --id=${dbupProject} --outFolder=${dbupProject}/artifacts --basePath=${dbupProject}/output --version=${version}`);
				core.info(`Push ${dbupProject} to Octopus...`);
				await exec(`dotnet octo push --package=${dbupProject}/artifacts/${dbupProject}.${version}.nupkg --server=${octopusUrl} --apiKey=${octopusApiKey}`);
			}

			core.info(dockerProject);
			core.info(`Building Docker Image: ${repoName}`);
			await exec(`docker build -f ./${dockerProject}/Dockerfile -t ${repoName} .`);
			core.info(`Tagging Docker Image: ${registryHost}/${repoName}`);
			const imageTag = `${registryHost}/${repoName}:${version}`;
			await exec(`docker tag ${repoName} ${imageTag}`);
			core.info(`Login to registry: ${registryHost} with ${registryUsername}`);
			await exec(`docker login ${registryHost} -u ${registryUsername} -p ${registryPassword}`);
			core.info(`Push to registry: ${imageTag}`);
			await exec(`docker push ${imageTag}`);
			core.info(`Push complete`);

			core.info("Creating Release...");
			await exec(`dotnet octo create-release --project=${repoName} --version=${version} --server=${octopusUrl} --apiKey=${octopusApiKey}`);
			if (msTeamsWebhook) {
				sendTeamsNotification(repoName, `✔ Version ${version} Deployed to Octopus`, msTeamsWebhook);
			}
		}
		core.info("✅ complete");
	} catch (err) {
		core.error("❌ Failed");
		core.setFailed(err.message);
	}
}

main();
