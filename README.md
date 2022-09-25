# Planck.js

> This is a fork of [planck.js](https://github.com/shakiba/planck.js) from v1.0.0-alpha.4.

This is published as a reference of the changes made. It is not intended to be used by anyone else so use at your own risk.

See [CHANGES.md](./CHANGES.md) to see the changes that have been made to the fork.

## Main Goals (Fork motivation)

Planck.js was not tree-shakable. This fork bundles the library as ESM without any dependencies and removes coupling between different classes so they can be more easily removed. This can result in up to a 50% reduction of bundle size compared to the UMD version (based on which classes you use).

## How to use

* Pull repo
* `npm ci` to install dependencies
* `npm run build` to create `dist` folder
* `npm pack` to create a tarball to be installed
* Copy the tarball into the destination repo
* Install the local tarball with `npm install --save <relative-tar-path>`
    * Be sure that the path you use is relative (or absolute). Eg: `./folder/planck` not `folder/planck`.
