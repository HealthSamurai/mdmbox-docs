---
description: Choose, edit, and load server-side merge and unmerge algorithms.
---

# Algorithm management

Algorithms build the transaction for [server-managed merge](merge-operation.md#server-managed-merge) and [unmerge](unmerge-operation.md#server-managed-unmerge). Start with a built-in algorithm, or create a custom JavaScript script when your policy needs different behavior. Client-plan operations do not use these scripts.

## Built-in algorithms

| Operation | Algorithm | Behavior |
| --- | --- | --- |
| Merge | `simple` (default) | Optionally replaces target content, moves references in the selected resource types, and deletes the source |
| Unmerge | `restore` (default) | Restores saved pre-merge content, overwriting later edits with warnings |
| Unmerge | `strict` | Reverses compatible merge changes and refuses conflicts; see [strict limitations](unmerge-operation.md#algorithms) |

Select an algorithm with `merge-algorithm` or `unmerge-algorithm` in the request. These are separate catalogs: the same ID can exist in both.

`MDMBOX_BUILT_IN_ALGORITHMS` controls which built-ins are available. Unset enables all; an empty value disables all; `simple,strict` enables only those two. Unknown IDs prevent startup. Changing this setting requires a restart and does not restrict custom algorithms.

The default IDs remain `simple` and `restore`. If a default is unavailable, the request returns HTTP 400; MDMbox does not choose a different algorithm automatically.

## Create or edit a script

1. Open **Algorithms → Merge** or **Algorithms → Unmerge** in the Admin UI.
2. Select an existing algorithm and choose **Duplicate**, or choose **New Algorithm**.
3. Give the script a unique ID and edit its JavaScript.
4. Save. MDMbox validates the entry point; the saved script is available to subsequent requests without a restart.

Use `function merge(input, mdm)` or `function unmerge(input, mdm)` and return `{plan: bundle}` with an optional OperationOutcome. See the [JavaScript algorithm API](javascript-algorithm-api.md) for inputs, helpers, examples, limits, and allowed changes. Use operation preview to inspect a script's proposed changes before executing them.

Database scripts are editable and can be deleted. Built-in and Git scripts are read-only; duplicate them to create an editable database copy. The editor shows the storage type and, for Git, the source, path, and published commit.

Only trusted administrators should manage scripts and Git sources. Algorithm code can read and propose changes to the resources allowed by its operation.

## Git algorithm storage

Store self-contained JavaScript files in a small repository:

```text
merge/
  identifier-union.js    # function merge(input, mdm)
unmerge/
  custom-restore.js      # function unmerge(input, mdm)
```

The filename without `.js` is the algorithm ID. IDs are 1–64 characters, start with a letter or digit, and contain only letters, digits, `.`, `_`, or `-`.

Only regular `.js` files directly inside these directories are supported. Nested files, symlinks, and submodules there are rejected; other repository paths are ignored. A repository must contain 1–100 algorithm files, with at most 1 MiB per file and 16 MiB of source in total. Imports and build steps are not supported.

### Add and synchronize a source

1. Open **Algorithms → Configuration** and choose **Add Git source**.
2. Enter a unique source ID, repository URL, and ref. Use `HEAD`, a full branch ref such as `refs/heads/main`, a full tag ref, or a 40-character commit SHA that the remote allows fetching.
3. For private repositories, configure access as described below. Choose **Save source**.
4. Choose **Sync**. Saving configuration alone does not fetch scripts.

Sync fetches and validates all scripts, then publishes both catalogs together. A failed sync keeps the last successful catalog and commit. Operations use the published scripts even when Git is unavailable. A sync does not change an operation already in progress.

After changing scripts in Git, choose **Sync** again. There is no automatic polling. Branches and tags are resolved again on sync; a commit SHA stays pinned. Fetch and validation must finish within 60 seconds, so keep the repository and its history small.

### Private repository access

For HTTPS, mount a read-only token file and give the container's `app` user access to it. Enter its absolute server-side path and the Git username in the source form. Do not paste tokens into the form or put credentials in repository URLs or scripts. An optional mounted PEM CA file supports private certificate authorities.

For SSH, use a URL such as `ssh://git@git.example/team/mdm-algorithms.git`. Provide a read-only deploy key and verified `known_hosts` under the runtime user's `.ssh` directory, or use an SSH agent. Interactive passwords and host-key prompts are not supported. The Docker image includes Git and OpenSSH; other deployments must install them.

Required credential and CA files must be available on every instance that can perform Sync. Stored token contents and credential-file paths are not returned to the browser.

### Edit or remove a source

**Edit** changes source configuration; published scripts stay unchanged until a successful Sync. Blank credential fields keep existing values; use the clear checkboxes to remove them. Reload the form if another administrator has changed it.

**Remove** deletes the source and its published Git scripts. It keeps the remote repository, database-authored scripts, and past operation Tasks. Running operations keep the script they already selected.

Runtime sources and their published scripts survive restarts. Up to 20 sources are allowed, including the environment source. Up to two syncs can run per instance, and only one sync per source can run across instances. After a process interruption, retry that source after its 90-second lease expires.

### Configure a source through the environment

You can also configure the reserved `environment` source at deployment time:

```yaml
MDMBOX_ALGORITHM_GIT_URL: https://git.example/team/mdm-algorithms.git
MDMBOX_ALGORITHM_GIT_REF: refs/tags/release-1
MDMBOX_ALGORITHM_GIT_USERNAME: deploy-user
MDMBOX_ALGORITHM_GIT_TOKEN_FILE: /run/secrets/algorithm-git-token
```

This source appears in **Algorithms → Configuration** with an **Environment** badge. You can Sync it there, but editing or removing its configuration requires changing the environment and restarting. It refreshes at startup; an invalid configuration or failed refresh prevents startup.

Removing `MDMBOX_ALGORITHM_GIT_URL` removes only this source. Other runtime sources remain available. Keep environment settings consistent across instances sharing the database. See [Configuration reference](config-reference.md#merge-and-unmerge-algorithms) for all variables.

## Which script runs?

For a given operation and ID, MDMbox chooses an enabled built-in first, then Git, then database storage. Disabling a built-in allows a custom script with the same ID to be selected. The database merge ID `simple` is reserved.

Two Git sources cannot publish the same operation and algorithm ID. A conflicting sync fails without changing published scripts. Removing a Git source can expose a database script with the same ID.

Each executed operation records the selected algorithm and script SHA-256 in its Task. Git algorithms also record the source ID, exact commit, and path. Repository URLs and credentials are not copied to Tasks.

Catalog views, script and source changes, and manual sync are [audited](audit.md#other-admin-ui-operation-codes).
