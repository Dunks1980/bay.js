# <img src="https://unpkg.com/@dunks1980/bay.js/favicon.svg?v=1" width="40"> bay.js

An easy to use, lightweight library for web-components. It doesn't need a build step but can be included in a build step if you want to. It's a great way to create reusable components for your projects. It's available as a NPM package and doesn't use any dependencies and is 4kb minified + gzipped. It also doesn't use eval or new Function so can be used in strict CSP polices without a build step. For documentation and demos go to [Bayjs.org](https://bayjs.org/examples/index.html).
<br />

If you wish to support this project please [buy me a coffee.](https://www.buymeacoffee.com/dunks1980) ☕
<br />
<br />

## Installation

Bay.js can be used via CDN or via NPM.

#### CDN
```html
<script src="//unpkg.com/@dunks1980/bay.js/bay.min.js"></script>
```
#### NPM
```javascript
npm i @dunks1980/bay.js
import bay from '@dunks1980/bay.js';
bay.default();
```

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
bay.default();
bay.default.create("my-component", my_component, ["message"]);
```

```html
<!-- Anywhere in the HTML including other components -->
<my-component message="Hello world!"></my-component>
```

A component can be used anywhere in the HTML but inline templates must be in the body of the document. "my-component" can be anything you like but it must have a dash in the name per the custom element spec.<br>
