import _ from 'lodash';
import Promise from 'bluebird';
import GitLabApi from 'gitlab';
import constants from './constants'
import config from './config'

/*
 * GitLab API connection
 */
let gitlab = null;

const getApi = () => {
  if (!gitlab) {
    gitlab = new GitLabApi({
      url: config.GITLAB_URL,
      token: config.TOKEN
    });
  }

  return gitlab;
};

/*
 * Only valid Javascript for Connections.
 */
const validConnectionsOnly = (fileName) => /\.(js)$/i.test(fileName) || fileName === 'settings.json';

const getBaseDir = () => {
  let baseDir = config.BASE_DIR || '';
  if (baseDir.startsWith('/')) baseDir = baseDir.slice(1);
  if (baseDir !== '' && !baseDir.endsWith('/')) baseDir += '/';

  return baseDir;
};

/*
 * Parse the repository.
 */
const parseRepo = (repository = '') => {
  const parts = repository.split('/');
  if (parts.length === 2) {
    const [ user, repo ] = parts;
    return { user, repo };
  } else if (parts.length === 5) {
    const [ , , , user, repo ] = parts;
    return { user, repo };
  }

  throw new Error(`Invalid repository: ${repository}`);
};

const getTreeByPath = (projectId, branch, directory) =>
  getApi().Repositories.tree(projectId, {
    ref: branch,
    path: getBaseDir() + directory
  }).then((res) => {
    if (!res) {
      console.log("no result");
      return [];
    }
    const files = res
      .filter(f => f.type === 'blob')
      //.filter(f => utils.validFilesOnly(f.path));

    files.forEach((elem, idx) => {
      files[idx].path = `${getBaseDir()}${directory}/${elem.name}`;
    });
    //console.log(files);
    return files;
  });

  /*
 * Get connection files for one db connection
 */
const getDBConnectionTreeByPath = (projectId, branch, filePath) =>
getApi().Repositories.tree(projectId, {
  ref: branch,
  path: `${getBaseDir()}${constants.DATABASE_CONNECTIONS_DIRECTORY}/${filePath}`
}).then((res) => {
  if (!res) {
    //console.log("no files");
    return [];
  }

  const files = res
    .filter(f => f.type === 'blob')
    .filter(f => validConnectionsOnly(f.name));

  files.forEach((elem, idx) => {
    files[idx].path = `${getBaseDir()}${constants.DATABASE_CONNECTIONS_DIRECTORY}/${filePath}/${elem.name}`;
  });

  //console.log(files);
  return files;
});

/*
* Get all files for all database-connections.
*/
const getDBConnectionsTree = (projectId, branch) =>
getApi().Repositories.tree(projectId, {
  ref: branch,
  path: getBaseDir() + constants.DATABASE_CONNECTIONS_DIRECTORY
}).then((res) => {
  if (!res) {
    return [];
  }

  const subdirs = res.filter(f => f.type === 'tree');
  const promisses = [];
  let files = [];

  subdirs.forEach(subdir => {
    promisses.push(getDBConnectionTreeByPath(projectId, branch, subdir.name).then(data => {
      files = files.concat(data);
    }));
  });

  return Promise.all(promisses)
    .then(() => {console.log(files); files});
});

/*
 * Get full tree.
 */
const getTree = (projectId, branch) => {
  // Getting separate trees for rules and connections, as GitLab does not provide full (recursive) tree
  const promises = {
    rules: getTreeByPath(projectId, branch, constants.RULES_DIRECTORY),
    databases: getDBConnectionsTree(projectId, branch),
    emails: getTreeByPath(projectId, branch, constants.EMAIL_TEMPLATES_DIRECTORY),
    pages: getTreeByPath(projectId, branch, constants.PAGES_DIRECTORY),
    clients: getTreeByPath(projectId, branch, constants.CLIENTS_DIRECTORY),
    clientGrants: getTreeByPath(projectId, branch, constants.CLIENTS_GRANTS_DIRECTORY),
    connections: getTreeByPath(projectId, branch, constants.CONNECTIONS_DIRECTORY),
    rulesConfigs: getTreeByPath(projectId, branch, constants.RULES_CONFIGS_DIRECTORY),
    resourceServers: getTreeByPath(projectId, branch, constants.RESOURCE_SERVERS_DIRECTORY)
  };

  return Promise.props(promises)
    .then((result) => (_.union(
      result.rules,
      result.databases,
      result.emails,
      result.pages,
      result.clients,
      result.clientGrants,
      result.connections,
      result.rulesConfigs,
      result.resourceServers
    )));
};


/*
 * Download a single file.
 */
const downloadFile = (projectId, branch, file) =>
  getApi().RepositoryFiles.show(projectId, file.path, branch)
    .then((data) => ({
      fileName: file.path,
      contents: (new Buffer(data.content, 'base64')).toString()
    }));


/*
 * Get a project id by path.
 */
const getProjectId = () => {
  const { user, repo } = parseRepo(config.REPOSITORY);
  const repository = `${user}/${repo}`;

  return getApi().Projects.all({ membership: true }).then(projects => {
    if (!projects) {
      return Promise.reject(new Error('Unable to determine project ID'));
    }

    const currentProject = projects.filter(f => f.path_with_namespace === repository);

    if (currentProject[0] && currentProject[0].id) {
      return currentProject[0].id;
    }

    return Promise.reject(new Error('Unable to determine project ID'));
  });
};

const dumpAll = (projectId, branch) => {
  const downloads = [];
  getTree(projectId, branch).then(
    files => {files.forEach(file => {
      downloads.push(downloadFile(projectId, branch, file)
        .then(res => {
          console.dir(res)
        })
      );
    })
  });

  return Promise.all(downloads)
    .then(() => {return ("dump completed..")});
}

/*
 * Get default options for manual deploy
 */
export const run = (req) =>
  getProjectId()
    .then(projectId => {
      console.log("Project Id: " + projectId);
      dumpAll(config.REPOSITORY, config.BRANCH).then(
      res => {
        console.log(res);
      })
    });


// Execute the API calls to Gitlab similar to extension
run();