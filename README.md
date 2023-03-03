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

| Syntax | Description | Example |
|--- |--- |--- |
| bay(); | Used to initialise bay.js if imported module. | [Installation](https://bayjs.org/examples?tab=installation&item=installation_esmodule) |
| bay.create('component-name', '\<h1>test\</h1>', ["prop-1", "prop-2"]); | Create a component. | [Create](https://bayjs.org/examples?tab=functions&item=example_functions_create) |
| bay.refresh(); | Refresh bay when a new custom element tag is dynamically applied to the DOM. | [Refresh](https://bayjs.org/examples?tab=functions&item=example_functions_refresh) |

<hr />


## Functions inside a component:

| Syntax | Description | Example |
|--- |--- |--- |
| $bay.encode('string'); | Encode/escape a string. | [Encode](https://bayjs.org/examples?tab=functions&item=example_functions_encode) |
| $bay.decode('string'); | Decode/un-escape a string. | [Decode](https://bayjs.org/examples?tab=functions&item=example_functions_decode) |
| $bay.emit('custom-event', {key: value}); | Emit a custom event. (across all components) | [Emit](https://bayjs.org/examples?tab=state&item=example_emit) |
| $bay.on('custom-event', (e) => console.log(e.detail)); | Listen for a custom event. (across all components) | [Emit](https://bayjs.org/examples?tab=state&item=example_emit) |

<hr />

## Variables inside a component:

| Syntax | Description | Example |
|--- |--- |--- |
| this.xxx = 'xxx'; | Assigning this.xxx a value will trigger a bay component render. | [Local](https://bayjs.org/examples?tab=state&item=example_local) |
| $global = 'xxx'; | Assigning $global.xxx a value will trigger render on all bay components that contain $global. | [Global](https://bayjs.org/examples?tab=state&item=example_global) |
| $bay.querySelector('xxx'); | Use $bay to get elements in the shadowDOM. | [Variables](https://bayjs.org/examples?tab=template&item=example_template_variables) |
| $el.querySelector('xxx'); | Use $el to get elements in the lightDOM. | [Variables](https://bayjs.org/examples?tab=template&item=example_template_variables) |
| $parent.xxx = 'xxx'; | Assigning $parent.xxx a value will update this.xxx in parent if the parent is another bay component and inturn triggers a render. | [Parent](https://bayjs.org/examples?tab=state&item=example_parent) |
| $details.changed; <br> $details.element; | Details from the slotchange script attribute as to what changed. | [Slots](https://bayjs.org/examples?tab=tags&item=example_tags_slots) |
| $route | Details from the window location. | [Router](https://bayjs.org/examples?tab=router&item=component_route) |
| $path | :variables from the search path :xxx/:xxx. | [Router](https://bayjs.org/examples?tab=router&item=component_route) |

<hr />

## Attributes on component element:

| Syntax | Description | Example |
|--- |--- |--- |
| bay="#my-template" <br> bay="/my-template.html" <br> bay="dsd" | The template to use, can be a templates id or a path to a file, dsd is experimental. | [DSD](https://bayjs.org/examples?tab=template&item=example_template_dsd) |
| fouc | Used to show the component only when and hide lightDOM until fully loaded. | [FOUC](https://bayjs.org/examples?tab=attributes&item=example_attrs_fouc) |
| inner-html="#render-target" | Used to tell the component where it should render \<inner-html>\</inner-html> content. | [Inner HTML](https://bayjs.org/examples?tab=tags&item=example_tags_innerhtml_render) |
| xxx="value" | Any other attributes are passed into the component and become props that can be accessed via this.xxx, xxx being the attribute name. | [Props](https://bayjs.org/examples?tab=state&item=example_props) |

<hr />

## Attributes in components: 

| Syntax | Description | Example |
|--- |--- |--- |
| :style="color: red; display: ${this.display}" | Apply inlined data driven styles. | [Styles](https://bayjs.org/examples?tab=attributes&item=example_attrs_styles) |
| :click="console.log('clicked')" | Any javascript event that begins with on (onclick in this example) just replace on with : (oninput="xxx" -> :input="xxx"). | [Events](https://bayjs.org/examples?tab=attributes&item=example_attrs_events) |
| :my-event="console.log('my custom event')" | Listens for any custom event and triggers code when it detects that event has been triggered from anywhere. | [Custom event](https://bayjs.org/examples?tab=state&item=example_emit) |
| bind="this.xxx" | Used for 2-way data binding on \<inputs>, \<selects> and \<textareas>. | [Bind](https://bayjs.org/examples?tab=state&item=example_bind) |
| slot="slot-name" | Used to define a slot as per standard web-component. | [Slot](https://bayjs.org/examples?tab=tags&item=example_tags_slots) |


