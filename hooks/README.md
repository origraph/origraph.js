These files are for developing this library and the [main Origraph app](https://github.com/origraph/origraph.github.io) together—specifically, they ensure that your current changes are committed with the main Origraph app, without needing to publish new releases. Of course, you only should use this for testing—formal releases should always accompany real deployments.

# Setup
1. Run `npm link` in this repository (you may need `sudo` if you don't use nvm)
2. Add the contents of each of the hooks in this directory to the corresponding scripts in `wherever/you/installed/origraph.github.io/.git/hooks/` (just copy them over if they're missing)
3. In the `origraph.github.io` repository, run `npm link origraph`

At this point you should be able to edit the library and the app together. To avoid having to rebuild the library for each change, you can run `npm run watchumd` in this respository to auto-build any changes.
