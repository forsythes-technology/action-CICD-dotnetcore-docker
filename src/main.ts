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
		const context = github.context;
		const projectName = context.repo.repo;
		const createRelease = (createReleaseInput.toLowerCase() === "true");
		if (createRelease && (!octopusUrl || !octopusApiKey)) {
			throw new Error("Cannot create a release without OCTOPUS_URL and OCTOPUS_APIKEY being defined");
		}
		core.info(`Building solution (ref: ${context.ref})...`);
		core.info("Build...");
		await exec(`dotnet build`);
		core.info("Test...");
		await exec(`dotnet test`);
		core.info("Publish...");
		await exec(`dotnet publish -p:PublishDir=output -c Release`);
		if (createRelease) { // Build, pack and release
			if (context.ref.indexOf("refs/tags/") === -1) {
				throw new Error("Unable to get a version number");
			}
			const version = context.ref.replace("refs/tags/", "");
			core.info(`🐙 Deploying project ${projectName} (Version ${version}) to Octopus `);
			core.info("Installing octopus cli...");
			await exec(`dotnet tool install octopus.dotnet.cli --tool-path .`);
			// generate a package for each project and push to Octopus
			if (dbupProject) {
				core.info(`Deploying DbUp project: ${dbupProject}`);
				await exec(`.\\dotnet-octo pack --id=${dbupProject} --outFolder=${dbupProject}\\artifacts --basePath=${dbupProject}\\output --version=${version}`);
				core.info(`Push ${dbupProject} to Octopus...`);
				await exec(`.\\dotnet-octo push --package=${dbupProject}\\artifacts\\${dbupProject}.${version}.nupkg --server=${octopusUrl} --apiKey=${octopusApiKey}`);
			}

			core.info(projectName);
			core.info(`Deploying project: ${projectName}`);
			await exec(`.\\dotnet-octo pack --id=${projectName} --outFolder=${projectName}\\artifacts --basePath=\\ --version=${version}`);
			core.info(`Push ${projectName} to Octopus...`);
			await exec(`.\\dotnet-octo push --package=${projectName}\\artifacts\\${projectName}.${version}.nupkg --server=${octopusUrl} --apiKey=${octopusApiKey}`);

			core.info("Creating Release...");
			await exec(`.\\dotnet-octo create-release --project=${projectName} --version=${version} --server=${octopusUrl} --apiKey=${octopusApiKey}`);
			if (msTeamsWebhook) {
				sendTeamsNotification(projectName, `✔ Version ${version} Deployed to Octopus`, msTeamsWebhook);
			}
		}
		core.info("✅ complete");
	} catch (err) {
		core.error("❌ Failed");
		core.setFailed(err.message);
	}
}

main();
