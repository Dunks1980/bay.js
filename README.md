# <img src="https://unpkg.com/@dunks1980/bay.js/bayjswide.svg?v=1" width="40"> bay.js

An easy to use, lightweight framework for web-components. Go to [Bayjs.org](https://bayjs.org/) for documentation and demos.
<br />

If you wish to support this project please [buy me a coffee.](https://www.buymeacoffee.com/dunks1980) ☕
<br />
<br />

## Installation

Bay.js can be installed 2 ways - via CDN or via NPM.

#### CDN
```html
<script src="//unpkg.com/@dunks1980/bay.js/bay.js"></script>
```
#### NPM
```javascript
npm i @dunks1980/bay.js
import bay from '@dunks1980/bay.js';
bay.default();
```

## Usage

There are 2 ways to define a component in bay.js: <br> 

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

A component can be used anywhere in the HTML but inline templates must be in the body of the document. "my-component" can be anything you like but it must have a dash in the name per the custom element spec.<br>
