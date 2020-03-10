## Dotnet Core CI + Octopus Deploy

This action creates an Octopus Release given a DotNet Core solution.

# Usage
```

- uses: actions/checkout@v1
- uses: forsythes-technology/action-CICD-dotnetCore@master
      with: 
	    CREATE_RELEASE: true # If set to 'true' the package will be deployed to octopus and a release will be created.
        PROJECTS: e.g. MyProject or MyProject,MyOtherProject  # Optional, must be included if CREATE_RELEASE is true
        OCTOPUS_URL: ${{secrets.OCTOPUS_URL}} # Optional
        OCTOPUS_APIKEY: ${{secrets.OCTOPUS_APIKEY}} # Optional
        DEPLOY_TO: Staging # Optional, if included the release will be deployed to this environment automatically
        OCTOPUS_PROJECT: Example-Project # Optional, if omitted repo name is used instead
        MS_TEAMS_WEBHOOK: <webhook_url> # Optional
```