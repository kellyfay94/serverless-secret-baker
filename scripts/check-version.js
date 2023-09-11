/**
 * During the CircleCI Build Pipeline, checks that the Git Tag matches the
 *  versions in package.json and package-lock.json
 */

const packageVersion = require(`${process.cwd()}/package.json`).version;
const packageLockVersion = require(`${process.cwd()}/package-lock.json`).version;

const TAG = process.env.CIRCLE_TAG || '';

if (packageVersion !== TAG || packageLockVersion !== TAG) {
  console.error(`Package versions "${packageVersion}", "${packageLockVersion}" do not match tag "${TAG}"`);
  process.exit(1);
}

process.exit(0);
