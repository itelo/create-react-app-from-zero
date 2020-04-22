import { GluegunToolbox, print } from 'gluegun';
import { execSync } from 'child_process';
import * as fse from 'fs-extra';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as hyperquest from 'hyperquest';
import { unpack } from 'tar-pack';

type ExtractPromiseGeneric<P> = P extends Promise<infer T> ? T : never;

const currentDirectory = fs.realpathSync(process.cwd());

function throwError(func: Function) {
  return func;
}

function CatchError(err: Function | Error) {
  if (typeof err === 'function') {
    return err()
  }
  print.error(err);
}

function checkIfNameExistsInDirectory(appDirectory) {
  return async () => {
    if (!(await fse.pathExists(appDirectory))) {
      return
    }

    throw throwError(() => {
      print.error('Invalid project name')
      print.error(
        'the project name you passed already existis in the current directory as a file or directory, try to move to another one'
      )
    })
  }
}

function getNpmTemplatePackageName(templateName: string) {
  return async () => {
    if (templateName) {
      return `cra-clone-${templateName}-template`;
    }

    return 'cra-clone-template';
  }
}

async function getNpmPackageUrl(
  npmTemplatePackageName: ExtractPromiseGeneric<
    ReturnType<ReturnType<typeof getNpmTemplatePackageName>>
  >
) {
  return {
    npmTemplatePackageName,
    urlNpmPackage: execSync(`npm v ${npmTemplatePackageName} dist.tarball`)
      .toString()
      .trim()
  }
}

function extractStream(stream, dest) {
  return new Promise((resolve, reject) => {
    stream.pipe(
      unpack(dest, err => {
        if (err) {
          reject(err)
        } else {
          resolve(dest)
        }
      })
    )
  });
}

function downloadTemplate(tmpDir: string) {
  return async (
    chainData: ExtractPromiseGeneric<ReturnType<typeof getNpmPackageUrl>>
  ) => {
    const stream = hyperquest(chainData.urlNpmPackage);

    print.info(`downloading template`);

    await extractStream(stream, tmpDir);

    print.success(`downloaded template`);

    return chainData;
  }
}

function copyTemplateToAppDirectory(tmpDir: string, appDirectory: string) {
  return async (
    chainData: ExtractPromiseGeneric<ReturnType<typeof getNpmPackageUrl>>
  ) => {
    print.info(`copying template to ${appDirectory}`);

    await fse.copy(`${tmpDir}/template`, appDirectory, {
      overwrite: false,
      errorOnExist: true
    });

    print.success(`copied template to ${appDirectory}`);

    return chainData;
  }
}

function deleteTmpDir(tmpDir: string) {
  return fse.remove(tmpDir);
}

async function starting() {
  print.info(`creating a react project`)
}

module.exports = {
  name: 'init',
  alias: ['init'],
  run: async (toolbox: GluegunToolbox) => {
    /**
     * initing global/local variables
     */
    const projectName = toolbox.parameters.options.name;
    const templateName = toolbox.parameters.options.template;
    const appDirectory = `${currentDirectory}/${projectName}`;
    const cracloneUUIDv4 = `create-react-app-from-zero-${uuidv4()}`;
    const tmpDir = `/tmp/${cracloneUUIDv4}`;

    /**
     * real start
     */
    starting()
      .then(checkIfNameExistsInDirectory(appDirectory))
      .then(getNpmTemplatePackageName(templateName))
      .then(getNpmPackageUrl)
      .then(downloadTemplate(tmpDir))
      .then(copyTemplateToAppDirectory(tmpDir, appDirectory))
      .then(deleteTmpDir(tmpDir))
      .catch(CatchError)
  },
}
  