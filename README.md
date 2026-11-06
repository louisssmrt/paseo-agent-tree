# Agent Tree for Paseo

A Paseo plugin that shows agents as a tree in the sidebar: machine, project, agent, subagents. See [OVERVIEW.md](OVERVIEW.md) for what it does, its settings and its limits ([version française](OVERVIEW.fr.md)).

## Install

```bash
paseo plugin add git:louisssmrt/paseo-agent-tree
paseo plugin ls
```

Requires Paseo 0.15.0 or later and plugins enabled on the daemon.

## Develop

```bash
npm install
npm run typecheck
npm test
```

`npm test` uses synthetic data only. `npm run debug:live` reads the machine running at 127.0.0.1:6767 and prints the real tree, which is handy while developing.

## License

MIT, see [LICENSE](LICENSE).
