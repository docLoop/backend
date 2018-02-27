# docloopBackend

This is the backend for the example [docloop](http://github.com/docloop/core) app.

To make this run, you have to create a config.js in the directory you cloned into.

```javascript
module.exports = {
	core: 		{}, //config for DocloopCore
	github: 	{}, //config for GithubAdapter
	paperhive: 	{}, //config for PaperhiveAdapter
}
```

* [docloopCore](http://github.com/docloop/core)
* [PaperhiveAdapter](http://github.com/docloop/paperhive-adapter)
* [GithubAdapter](http://github.com/docloop/github-adapter)