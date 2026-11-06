Agent Tree replaces the sidebar's flat workspace list with a tree: machine, then project, then agent, then subagents.

Each connected machine is a root, shown dimmed and marked offline when it does not answer. A project is named after the workspace folder, never after the git branch. Agents that are not archived sit under their project, most recent first, with one small status dot at the right: green for running, orange for a permission request, red for an error, nothing when idle. Every level expands and collapses, and the state is remembered. Each machine name is drawn in its own color, blue for the local machine by default.

Subagents come from two sources. Paseo agents started by another agent are nested under their parent through the `paseo.parent-agent-id` label. Claude Code subagents started with the Agent or Task tool are read from the end of each recent agent's timeline and shown with their description and status. Subagents are collapsed by default, and a collapsed row shows how many it holds.

Agents whose folder is temporary or a system folder (tmp, temp, /tmp, /private/tmp, C:\Windows, System32) are hidden unless you turn them back on.

## Settings

Open them from the gear on the first machine row, by right click or long press on a machine, or under Settings, Plugins. Changes apply immediately. Per machine: display name, color (palette or hex) and hide. Global: replace the native list, temporary folders, subagent display and limit, archived and closed agents (hidden or dimmed), sort order, title length (30, 40 or 60), status dots, subagent counters, space above the tree, and the default expanded state of machines, projects and agents.

## Data and privacy

The plugin reads the agent list and workspace list of each connected machine, and the last part of an agent's timeline to find subagent calls. Turning subagents off stops timeline reads. Nothing is sent outside the app, and the plugin makes no network requests of its own. Preferences are stored in the Paseo plugin settings of the selected host.

## Limits

Replacing the native workspace list works on desktop and web only. It hides the native list with CSS rules that target Paseo's `data-testid` attributes, so a Paseo update can break it. When the expected elements are not found, nothing is hidden and one warning is written to the app console. On mobile the native list stays and the tree appears above it.

Clicking a Claude Code subagent opens its parent agent, because a subagent has no tab of its own. Timelines are read for the 40 most recently updated agents of each machine. Requires Paseo 0.15.0 or later.
