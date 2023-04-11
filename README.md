# <img src="https://cdn.jsdelivr.net/npm/@dunks1980/bay.js/favicon.svg?v=1" width="40"> bay.js
[![npm version](https://img.shields.io/npm/v/@dunks1980/bay.js)](https://npmjs.org/package/@dunks1980/bay.js) 
[![Known Vulnerabilities](https://snyk.io/test/github/dunks1980/bay.js/badge.svg?targetFile=package.json)](https://snyk.io/test/github/dunks1980/bay.js?targetFile=package.json) 
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://raw.githubusercontent.com/Dunks1980/bay.js/main/LICENSE)
<br />
<hr />


## What is bay.js?
Bay.js is a frontend library designed to facilitate the creation of reusable web-components, as well as to add state and interactivity to HTML.
To see it in action, you can visit [Bayjs.org](https://bayjs.org/examples/index.html) and explore its examples.
<hr />

## Key features

- Optional build step: Simply add a script tag to get started.
- Strict Content Security Policy (CSP) compatibility, even without a build step.
- Versatile rendering: Regular DOM or web-component formats.
- Zero dependencies for lightweight implementation.
- Single-file bundling capability for streamlined components.
- Seamless integration with frameworks designed for rendering web-components.
- URL-based templates: Enable server-side rendering (SSR) or PHP-based templates.
- Utilize `<template>` in the DOM as a template source.
- Component creation from JavaScript strings for dynamic customization.
- User-friendly syntax for effortless development.
<hr />

## Installation

Bay.js can be used via a script tag or importing as a module.

#### Script tag:
```html
<script src="//cdn.jsdelivr.net/npm/@dunks1980/bay.js/bay.min.js"></script>
```
<hr />

#### ES Module:
```html
<script type="module" src="main.js"></script>
```
```javascript
// In main.js
import bay from '//cdn.jsdelivr.net/npm/@dunks1980/bay.js/bay.min.mjs';
bay();
```
You may want to add a version number like this to prevent breaking changes: '//cdn.jsdelivr.net/npm/@dunks1980/bay.js@< VERSION >/bay.min.mjs' the version number is optional and can be acquired from going to the npm package page. Or if using node_modules: './node_modules/@dunks1980/bay.js/bay.min.mjs';
<hr />

#### NPM Module:
```javascript
npm i @dunks1980/bay.js
import bay from '@dunks1980/bay.js';
bay();
```
<hr />

## Usage

There are 3 ways to define a component in bay.js:<br> 

### 1. Template in the DOM. 
In your html create an inline template and supply bay.js the templates id:<br>
```html
<template id="my-template">
  <h1>${this.message}</h1>
</template>

<my-component bay="#my-template" message="Hello world!"></my-component>
```
<hr/>

### 2. Template in a file.
Create a file and supply bay.js the url (don't wrap file contents in template). The file extension can be anything you like as long as its contents are in the HTML format:<br>

```html
<my-component bay="/url/to/my/components.html" message="Hello world!"></my-component>
<!-- or -->
<my-component bay="/url/to/my/components.php" message="Hello world!"></my-component>
```

```html
<!-- in component file -->
<h1>${this.message}</h1>
```
<hr/>

### 3. Create a template with JS.
Pass bay.js the imported template:<br>
```js
import my_component from "./../component_imports/my_component.html?raw";
import bay from "@dunks1980/bay.js";
bay();
bay.create("my-component", my_component, ["message"]);
```

Or create template and pass it: ( $ and ` within the string will need \ escaping if string literal)<br>
```js
import bay from "@dunks1980/bay.js";
bay();
bay.create("my-component", `<h1>\${this.message}</h1>`, ["message"]);
```

```html
<!-- Anywhere in the HTML including other components -->
<my-component message="Hello world!"></my-component>
```

A component can be used anywhere in the HTML but inline templates must be in the body of the document. "my-component" can be anything you like but it must have a dash in the name per the custom element spec.<br>

<br />
<hr />
<br />

## Tags in components: 

| Syntax | Description | Example |
|--- |--- |--- |
| \<if this="this.xxx">...\</if> | If statement, renders only the content between \<if> tags if its this attribute is true. | [Conditionals](https://bayjs.org/examples?tab=tags&item=example_tags_conditionals) |
| \<else-if this="this.xxx">...\</else-if> | Else if, renders only the content between \<else-if> tags if its this attribute is true and previous \<if> \ \<else-if> is false. | [Conditionals](https://bayjs.org/examples?tab=tags&item=example_tags_conditionals) |
| \<else>...\</else> | Else, renders only the content between \<else> tags if all previous \<if> \ \<else-if> tags are false. | [Conditionals](https://bayjs.org/examples?tab=tags&item=example_tags_conditionals) |
| \<show this="this.xxx">...\</else> | Show, when you need to keep the code in the DOM and toggle its display. Add duration  \<show this="this.xxx" duration=".5s"> for a fade effect. | [Show](https://bayjs.org/examples?tab=tags&item=example_tags_show) |
| \<switch this="this.xxx"><br />\<case this="xxx" break>...\</case><br />\<default>...\</default><br />\</switch> | Switch statement, for more complex conditionals. | [Switch](https://bayjs.org/examples?tab=tags&item=example_tags_conditionals2) |
| \<map array="this.arr">...\</map> | Map, to iterate over an array \<map params="item, i, array" array="this.arr" join="\<hr>"> params and join are optional, default params are: element, index, array. | [Iterations](https://bayjs.org/examples?tab=tags&item=example_tags_iterations) |
| \<for array="this.arr">...\</for> | Foreach loop, to iterate over an array \<for params="item, i, array" array="this.arr"> params are optional, default params are: element, index, array. | [Iterations](https://bayjs.org/examples?tab=tags&item=example_tags_iterations) |
| \<for this="let i = 0; i < this.arr.length; i++">...\</for> | For loop, to iterate with conditions. | [Iterations](https://bayjs.org/examples?tab=tags&item=example_tags_iterations) |
| \<inner-html>...\</inner-html> | To render to the Light DOM. If inner-html attribute is present on the component it will render inside that element:<br /> \<my-comp bay="..." inner-html="#render-target">. If inner-html attribute is not present on the component you can use a slot to see the inner-html content. | [Inner HTML](https://bayjs.org/examples?tab=tags&item=example_tags_innerhtml) |
| \<slot name="slot1">...\</slot> | Used to define a slot as per standard web-component. | [Slots](https://bayjs.org/examples?tab=tags&item=example_tags_slots) |
| \<route href="/xxx/var">...\</route> | Route creates the route for the router tag, is intended for a single page application (SPA). | [Route](https://bayjs.org/examples?tab=router&item=component_route) |
| \<router this="/xxx/:xxx">...\</router> | Router matches the current url, :xxx are used for variables. | [Route](https://bayjs.org/examples?tab=router&item=component_route) |

<br />
<hr />
<br />

## Internal Variables:

| Syntax | Description | Example |
|--- |--- |--- |
| this.xxx = 'xxx'; | Assigning this.xxx a value will trigger a bay component render. <br>To get/set this value from outside the component: <br>document.getElementById('my-el').shadowRoot.proxy.xxx = 'xxx';  | [Local](https://bayjs.org/examples?tab=state&item=example_local) |
| $global = 'xxx'; | Assigning $global.xxx a value will trigger render on all bay components that contain $global. <br>To get/set this value from outside the components: <br>bay.global.xxx = 'hello'; console.log(bay.global); | [Global](https://bayjs.org/examples?tab=state&item=example_global) |
| $bay.querySelector('xxx'); | Use $bay to target the Shadow DOM. [Shadow DOM vs. Light DOM](https://fai.agency/blog/web-components-dom/) | [Variables](https://bayjs.org/examples?tab=template&item=example_template_variables) |
| $el.querySelector('xxx'); | Use $el to target the Light DOM. [Shadow DOM vs. Light DOM](https://fai.agency/blog/web-components-dom/) | [Variables](https://bayjs.org/examples?tab=template&item=example_template_variables) |
| $parent.xxx = 'xxx'; | Assigning $parent.xxx a value will update this.xxx in parent if the parent is another bay component and inturn triggers a render. | [Parent](https://bayjs.org/examples?tab=state&item=example_parent) |
| $details.changed; <br> $details.element; | Details from the slotchange script attribute as to what changed. | [Slots](https://bayjs.org/examples?tab=tags&item=example_tags_slots) |
| $route | Details from the window location. | [Router](https://bayjs.org/examples?tab=router&item=component_route) |
| $path | :variables from the search path :xxx/:xxx. | [Router](https://bayjs.org/examples?tab=router&item=component_route) |

<br />
<hr />
<br />

## Attributes On Component:

| Syntax | Description | Example |
|--- |--- |--- |
| bay="#my-template" <br> bay="/my-template.html" <br> bay="dsd" | The template to use, can be a templates id or a path to a file, dsd is experimental. | [DSD](https://bayjs.org/examples?tab=template&item=example_template_dsd) |
| fouc | Used to hide the Light DOM within the component until it is fully loaded. | [FOUC](https://bayjs.org/examples?tab=attributes&item=example_attrs_fouc) |
| inner-html="#render-target" | Used to tell the component where it should render \<inner-html>\</inner-html> content. | [Inner HTML](https://bayjs.org/examples?tab=tags&item=example_tags_innerhtml_render) |
| xxx="value" | Any other attributes are passed into the component and become props that can be accessed via this.xxx, xxx being the attribute name. | [Props](https://bayjs.org/examples?tab=state&item=example_props) |


<br />
<hr />
<br />

## Internal Attributes:

| Syntax | Description | Example |
|--- |--- |--- |
| :style="color: red; display: ${this.display}" | Apply inlined data driven styles. | [Styles](https://bayjs.org/examples?tab=attributes&item=example_attrs_styles) |
| :click="console.log('clicked')" | Any javascript event that begins with on (onclick in this example) just replace on with : (oninput="xxx" -> :input="xxx"). | [Events](https://bayjs.org/examples?tab=attributes&item=example_attrs_events) |
| :my-event="console.log('my custom event')" | Listens for any custom event and triggers code when it detects that event has been triggered from anywhere. | [Custom event](https://bayjs.org/examples?tab=state&item=example_emit) |
| bind="this.xxx" | Used for 2-way data binding on \<inputs>, \<selects> and \<textareas>. | [Bind](https://bayjs.org/examples?tab=state&item=example_bind) |
| slot="slot-name" | Used to define a slot as per standard web-component. | [Slots](https://bayjs.org/examples?tab=tags&item=example_tags_slots) |


<br />
<hr />
<br />

## External Functions:

| Syntax | Description | Example |
|--- |--- |--- |
| bay(); | Used to initialise bay.js if imported module. | [Installation](https://bayjs.org/examples?tab=installation&item=installation_esmodule) |
| bay.create('component-name', '\<h1>test\</h1>', ["prop-1", "prop-2"]); | Create a component. | [Create](https://bayjs.org/examples?tab=functions&item=example_functions_create) |
| bay.refresh(); | Refresh bay after a new custom element is dynamically applied to the DOM. | [Refresh](https://bayjs.org/examples?tab=functions&item=example_functions_refresh) |

<br />
<hr />
<br />

## Internal Functions:

| Syntax | Description | Example |
|--- |--- |--- |
| $bay.encode('string'); | Encode/escape a string. | [Encode](https://bayjs.org/examples?tab=functions&item=example_functions_encode) |
| $bay.decode('string'); | Decode/un-escape a string. | [Decode](https://bayjs.org/examples?tab=functions&item=example_functions_decode) |
| $bay.emit('custom-event', {key: value}); | Emit a custom event. (across all components) | [Emit](https://bayjs.org/examples?tab=state&item=example_emit) |
| $bay.on('custom-event', (e) => {console.log(e.detail);}); | Listen for a custom event. (across all components) | [Emit](https://bayjs.org/examples?tab=state&item=example_emit) |

<br />
<hr />
<br />