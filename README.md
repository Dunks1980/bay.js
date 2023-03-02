# <img src="https://unpkg.com/@dunks1980/bay.js/favicon.svg?v=1" width="40"> bay.js
<br />

[![npm version](https://img.shields.io/npm/v/@dunks1980/bay.js)](https://npmjs.org/package/@dunks1980/bay.js) 
[![Known Vulnerabilities](https://snyk.io/test/github/dunks1980/bay.js/badge.svg?targetFile=package.json)](https://snyk.io/test/github/dunks1980/bay.js?targetFile=package.json) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://raw.githubusercontent.com/Dunks1980/bay.js/main/LICENSE)
<br />

An easy to use, lightweight library for web-components. It doesn't need a build step but can be included in a build step if you want to. It's a great way to create reusable components for your projects. It's available as a NPM package and doesn't use any dependencies and is 4kb minified + gzipped. It also doesn't use eval or new Function so can be used in strict CSP polices without a build step. For documentation and demos go to [Bayjs.org](https://bayjs.org/examples/index.html).
<br />
<br />

## Installation

Bay.js can be used via a script tag or importing as a module.

#### Script tag:
```html
<script src="//unpkg.com/@dunks1980/bay.js/bay.min.js"></script>
```
<hr />

#### Module Script tag:
```html
<script type="module" src="main.js"></script>
```
```javascript
// In main.js
import bay from '//unpkg.com/@dunks1980/bay.js/bay.min.mjs';
bay();
```
You may want to add a version number like this to prevent breaking changes: '//unpkg.com/@dunks1980/bay.js@< VERSION >/bay.min.mjs' the version number is optional and can be acquired from going to the npm package page. Or if using node_modules: './node_modules/@dunks1980/bay.js/bay.min.mjs';
<hr />

#### Module NPM:
```javascript
npm i @dunks1980/bay.js
import bay from '@dunks1980/bay.js';
bay();
```
<hr />

## Usage

There are 3 ways to define a component in bay.js: <br> 

1. In your html create an inline template and supply bay.js the templates id.<br>
```html
<template id="my-template">
  <h1>${this.message}</h1>
</template>

<my-component bay="#my-template" message="Hello world!"></my-component>
```

2. Create a file and supply bay.js the url (don't wrap file contents in template). The file extension can be anything you like as long as its contents are in the HTML format.<br>

```html
<my-component bay="/url/to/my/components.html" message="Hello world!"></my-component>
<!-- or -->
<my-component bay="/url/to/my/components.php" message="Hello world!"></my-component>
```

```html
<!-- in component file -->
<h1>${this.message}</h1>
```

3. Pass bay.js the template<br>
```js
import my_component from "./../component_imports/my_component.html?raw";
import bay from "@dunks1980/bay.js";
bay();
bay.create("my-component", my_component, ["message"]);
```

```html
<!-- Anywhere in the HTML including other components -->
<my-component message="Hello world!"></my-component>
```

A component can be used anywhere in the HTML but inline templates must be in the body of the document. "my-component" can be anything you like but it must have a dash in the name per the custom element spec.<br>

<hr />

## Functions outside of components:

| Syntax      | Description |
| ----------- | ----------- |
| bay(); | Used to initialise bay.js. |
| bay.create('component-name', '\<h1>test\</h1>', '["prop-1", "prop-2"]'); | Create a component. |
| bay.refresh(); | Refresh bay custom element it is when dynamically applied to the DOM. |

<hr />


## Functions inside a component:

| Syntax      | Description |
| ----------- | ----------- |
| $bay.encode('string'); | Encode/escape a string. |
| $bay.decode('string'); | Decode/un-escape a string. |
| $bay.emit('custom-event', {key: value}); | Emit a custom event. (across all components) |
| $bay.on('custom-event', (e) => {console.log(e.detail);}); | Listen for a custom event. (across all components) |

<hr />

## Variables inside a component:

| Syntax      | Description |
| ----------- | ----------- |
| this.xxx = 'xxx'; | Assigning this.xxx a value will trigger a bay component render. |
| $global = 'xxx'; | Assigning $global.xxx a value will trigger render on all bay components that contain $global. |
| $bay.querySelector('xxx'); | Use $bay in place of document. |
| $el.querySelector('xxx'); | Use $el to get the component tag \<component-name>\</component-name>. |
| $parent.xxx = 'xxx'; | Assigning $parent.xxx a value will update this.xxx in parent if the parent is another bay component and inturn triggers a render. |
| $details.changed; $details.element; | Details from the slotchange script attribute as to what changed. |
| $route | Details from the window location. |
| $path | :variables from the search path :xxx/:xxx. |

