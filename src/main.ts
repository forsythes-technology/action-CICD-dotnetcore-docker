import * as core from "@actions/core";
import { exec } from "@actions/exec";
import * as github from "@actions/github";
import { sendTeamsNotification } from "./sendNotification";

async function main() {
	try {

		const createReleaseInput: string = core.getInput("CREATE_RELEASE", { required: true });
		const octopusUrl: string = core.getInput("OCTOPUS_URL", { required: false });
		const octopusApiKey: string = core.getInput("OCTOPUS_APIKEY", { required: false });
		const projectsInput = core.getInput("PROJECTS", { required: false });
		const octopusProject: string = core.getInput("OCTOPUS_PROJECT", { required: false });
		const deployTo: string = core.getInput("DEPLOY_TO", { required: false });
		const msTeamsWebhook: string = core.getInput("MS_TEAMS_WEBHOOK", { required: false });
		const context = github.context;
		const repo = context.repo.repo;
		const projectName = octopusProject ? octopusProject : repo;
		const projects = projectsInput.split(",");
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
			core.info(`🐙 Deploying projects ${projectsInput} (Version ${version}) to Octopus `);
			core.info("Installing octopus cli...");
			await exec(`dotnet tool install octopus.dotnet.cli --tool-path .`);
			// generate a package for each project and push to Octopus
			for (let i = 0; i < projects.length; i++) {
				const project = projects[i];
				const counter = `(${i}/${projects.length})`;
				core.info(project);
				core.info(`${counter} Packing...`);
				await exec(`.\\dotnet-octo pack --id=${project} --outFolder=${project}\\artifacts --basePath=${project}\\output --version=${version}`);
				core.info(`${counter} Push to Octopus...`);
				await exec(`.\\dotnet-octo push --package=${project}\\artifacts\\${project}.${version}.nupkg --server=${octopusUrl} --apiKey=${octopusApiKey}`);
			}
			core.info("Creating Release...");
			const deployToString = deployTo ? `--deployTo=${deployTo}` : "";
			await exec(`.\\dotnet-octo create-release --project=${projectName} --version=${version} --server=${octopusUrl} --apiKey=${octopusApiKey} ${deployToString}`);
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
