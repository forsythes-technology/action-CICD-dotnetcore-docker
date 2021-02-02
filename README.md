## Dotnet Core CI + Octopus Deploy

This action creates an Octopus Release given a DotNet Core solution and pushes raw files ready for docker commands.

# Building

This action's build is committed to source, consequently it must be built locally for changes to take effect.
You can build the solution using:
```
yarn build
```


# Usage
```

- uses: actions/checkout@v1
- uses: forsythes-technology/action-CICD-dotnetCore@master
      with: 
	    CREATE_RELEASE: true # If set to 'true' the package will be deployed to octopus and a release will be created.
        OCTOPUS_URL: ${{secrets.OCTOPUS_URL}} # Optional
        OCTOPUS_APIKEY: ${{secrets.OCTOPUS_APIKEY}} # Optional
		DBUP_PROJECT: pushes a seperate artifact to octopus if supplied (needs to be separate project like dbup proj)
        OCTOPUS_PROJECT: Example-Project # Optional, if omitted repo name is used instead
        MS_TEAMS_WEBHOOK: <webhook_url> # Optional
```