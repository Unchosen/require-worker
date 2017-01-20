# require-worker - Nodejs Module
> require with a fork

Load a module in a new process. Ideally similar to Nodejs's require().

## What is this?

This module is meant to require other Nodejs modules, but in a new process instead of the same process.

This is very new, experimental and features are still getting implemented.

There are many cases where this will not work with existing modules which accept data types, or return data types that are not yet implemented. Though this is being worked on. See the API below.

## Why use this?

Let's say you want to require a module, but the tasks it performs are synchronous and long, or simply does a lot of number crunching. That module would effect the performance and responsiveness of your application.

When using _require-worker_, that module would instead run in a different process, allowing your application to respond to incoming connections and do it's own number crunching at the same time, while still talking with that module in a similar way it used to.

I decided to create this module because simply creating a forked process and changing how you talk to the other code in the other process, can be cumbersome if your application is already quite complicated. Importing a module is easy. Most Nodejs applications require them to expand their functionality. Even modules themselves require other modules. So this module simply makes use of that ideology.

## Installation

Warning: This project is written with ES6 features. The examples are written with ES7 features.

This branch is not currently available on NPM, as this branch is still in pre-release development.

To try this pre-release, git clone this branch.

### How to use

Todo. See examples.

## Tests

Todo. Run examples for now.

## Contributors

Create issues on the GitHub project or create pull requests.

All the help is appreciated.

## License

MIT License

Copyright (c) 2017 Jason Sheppard @ https://github.com/Unchosen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

[npm-image]: https://img.shields.io/npm/v/require-worker.svg?style=flat-square
[npm-url]: https://npmjs.org/package/require-worker
[npm-downloads]: https://img.shields.io/npm/dm/require-worker.svg?style=flat-square