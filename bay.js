let bay = () => {
  "use strict";

  (function attachShadowRoots(root) {
    root.querySelectorAll("template[shadowroot]").forEach(template => {
      const mode = template.getAttribute("shadowroot");
      const shadowRoot = template.parentNode.attachShadow({ mode });
      shadowRoot.appendChild(template.content);
      template.remove();
      attachShadowRoots(shadowRoot);
    });
  })(document);

  window.bay = {};
  let local_name = '$bay';
  let store_name = '$global';
  let element_name = '$el';
  let file_name = '';
  let to_fetch = [];
  let already_fetched = [];

  function dispatch_global_event() {
    let evt = new CustomEvent("bay_global_event");
    window.dispatchEvent(evt);
  }

  if (!window.bay.global) {
    var global_data = {};
    var global_handler = {
      get(target, key) {
        if (key == 'isProxy') {
          return true;
        }
        const prop = target[key];
        if (typeof prop == 'undefined') {
          return;
        }
        if (prop == null) {
          return;
        }
        if (!prop.isProxy && typeof prop === 'object') {
          target[key] = new Proxy(prop, global_handler);
        }
        return target[key];
      },
      set: (target, key, value) => {
        target[key] = value;
        dispatch_global_event();
        return true;
      }
    };
    window.bay.global = new Proxy(global_data, global_handler);
  }

  function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  function decodeHtml(html) {
    var txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  }

  function get_all_bays(element) {
    let bays = [...element.querySelectorAll('[bay]')];
    bays.forEach((el, i) => {
      if (el.getAttribute('bay') === 'dsd') {
        el.setAttribute('bay', `dsd-${i}`);
      }
      let attr = el.getAttribute('bay');
      if (to_fetch.indexOf(attr) === -1) {
        to_fetch.push(el);
      }
    });
    to_fetch.forEach(el => {
      if (already_fetched.indexOf(el.getAttribute('bay')) === -1) {
        fetch_component(el);
      }
      already_fetched.push(el.getAttribute('bay'));
    });
  }

  function modify_template(template_el, bay) {
    var html;
    let styles_text;
    if (template_el.indexOf('<style>') > -1) {
      styles_text = template_el.split('<style>')[1].split('</style>')[0];
    }
    template_el = template_el
      .replaceAll(/<!--[\s\S]*?-->/g, '')
      .replaceAll(`<style>${styles_text}</style>`, '');

    var doc = new DOMParser();
    html = doc.parseFromString(template_el, "text/html");
    if (html) {
      if (!customElements.get(bay.tagName.toLowerCase())) {
        create_component(html, bay.tagName.toLowerCase(), getAttributes(bay), styles_text);
      }
    }
  }

  function fetch_component(bay) {
    try {
      let location = bay.getAttribute('bay');
      if (
        location.substring(0, 4) === 'dsd-'
      ) {
        file_name = location;
        if (!bay.shadowRoot) {
          modify_template(decodeHtml(bay.querySelector('template').innerHTML), bay);
        } else {
          modify_template(decodeHtml(bay.shadowRoot.innerHTML), bay);
        }
      } else if (
        location.substring(0, 1) === '#'
      ) {
        file_name = location;
        let template_el = document.querySelector(location);
        if (!template_el) {
          console.error(`bay: "${location}" no element found with this selector.`);
          return;
        }
        modify_template(template_el.innerHTML, bay);
      } else {
        var request = new XMLHttpRequest();
        request.open("GET", location);
        request.setRequestHeader("Content-Type", "text/plain");
        request.addEventListener("load", (event) => {
          modify_template(event.target.responseText, bay);
        });
        request.addEventListener("error", () => {
          console.error(
            'For CORS policy errors try this: https://stackoverflow.com/questions/10752055/cross-origin-requests-are-only-supported-for-http-error-when-loading-a-local');
        });
        request.send();
      }
    } catch (error) {
      console.error(error);
    }
  }

  function getAttributes(bay) {
    let all_attrs = [];
    let this_attrs = [...bay.attributes];
    this_attrs.forEach(attr => {
      if (
        attr.name !== 'bay' &&
        all_attrs.indexOf(attr.name) === -1
      ) {
        all_attrs.push(attr.name);
      }
    });
    return all_attrs;
  }

  function create_component(html, element_tagname, attrs, styles_text) {
    let compontent_tagname = '';
    let compontent_html = '';
    let script;
    let observedAttributes_from_element;
    try {

      // html ====================================================
      compontent_html = html.body;
      compontent_tagname = element_tagname;
      let update_el = document.createElement(`${element_tagname}-update`);
      compontent_html.appendChild(update_el);

      compontent_html.innerHTML = compontent_html.innerHTML
        .replaceAll('<noscript>', '')
        .replaceAll('</noscript>', '');

      // dsds ====================================================
      while ([...compontent_html.querySelectorAll('dsd')].length > 0) {
        let dsds = [...compontent_html.querySelectorAll('dsd')];
        dsds.forEach(dsd_el => {
          dsd_el.remove();
        });
      }

      // maps ====================================================
      while ([...compontent_html.querySelectorAll('map')].length > 0) {
        let maps = [...compontent_html.querySelectorAll('map')];
        maps.forEach(map_el => {
          let has_children = map_el.querySelector('map');
          if (!has_children) {
            let map_array = map_el.getAttribute('array') || [];
            let map_params = map_el.getAttribute('params') || 'element, index, array';
            let map_join = map_el.getAttribute('join') || '';
            while (map_el.attributes.length > 0)
              map_el.removeAttribute(map_el.attributes[0].name);
            let map_html = map_el.outerHTML;
            map_html = map_html
              .replace('<map>', `\${ ${map_array}.map((${map_params}) => { return \``)
              .replace('</map>', `\`}).join('${map_join}')}`);
            map_el.outerHTML = map_html;
          }
        });
      }

      // fors ====================================================
      while ([...compontent_html.querySelectorAll('for')].length > 0) {
        let fors = [...compontent_html.querySelectorAll('for')];
        fors.forEach(for_el => {
          let has_children = for_el.querySelector('for');
          if (!has_children) {
            let this_for = `bay_for_${makeid(8)}`;
            let for_array = for_el.getAttribute('array') || [];
            let for_params = for_el.getAttribute('params') || 'element, index, array';
            while (for_el.attributes.length > 0)
              for_el.removeAttribute(for_el.attributes[0].name);
            let for_html = for_el.outerHTML;
            for_html = for_html
              .replace('<for>', `\${(() => { let ${this_for} = ''; ${for_array}.forEach((${for_params}) => { ${this_for} += \``)
              .replace('</for>', `\`}); return ${this_for}; })() }`);
            for_el.outerHTML = for_html;
          }
        });
      }

      // if's ====================================================
      while ([...compontent_html.querySelectorAll('if')].length > 0) {
        let if_statments = [...compontent_html.querySelectorAll('if')];
        if_statments.forEach(if_statment_el => {
          // check if children
          let has_children = [...if_statment_el.querySelectorAll('if')];
          if (!has_children.length > 0) {
            let statement = [...if_statment_el.attributes][0] ? [...if_statment_el.attributes][0].nodeValue : '';
            let next_el = if_statment_el.nextElementSibling ? if_statment_el.nextElementSibling.tagName.toLowerCase() : '';
            while (if_statment_el.attributes.length > 0)
              if_statment_el.removeAttribute(if_statment_el.attributes[0].name);
            let if_html = if_statment_el.outerHTML;
            let close_func = `\` } return '' })() }`;
            if (next_el === 'else-if' || next_el === 'else') {
              close_func = `\` }`;
            }
            if_statment_el.outerHTML = if_html
              .replace('<if>', `\${(() => { if (${statement}) { return \``)
              .replace('</if>', close_func);
          }
        });
      }

      // else-if's ====================================================
      while ([...compontent_html.querySelectorAll('else-if')].length > 0) {
        let if_statments = [...compontent_html.querySelectorAll('else-if')];
        if_statments.forEach(if_statment_el => {
          // check if children
          let has_children = [...if_statment_el.querySelectorAll('else-if')];
          if (!has_children.length > 0) {
            let statement = [...if_statment_el.attributes][0] ? [...if_statment_el.attributes][0].nodeValue : '';
            let next_el = if_statment_el.nextElementSibling ? if_statment_el.nextElementSibling.tagName.toLowerCase() : '';
            while (if_statment_el.attributes.length > 0)
              if_statment_el.removeAttribute(if_statment_el.attributes[0].name);
            let if_html = if_statment_el.outerHTML;
            let close_func = `\` } return '' })() }`;
            if (next_el === 'else-if' || next_el === 'else') {
              close_func = `\` }`;
            }
            if_statment_el.outerHTML = if_html
              .replace('<else-if>', `\ else if (${statement}) { return \``)
              .replace('</else-if>', close_func);
          }
        });
      }

      // else's ====================================================
      while ([...compontent_html.querySelectorAll('else')].length > 0) {
        let if_statments = [...compontent_html.querySelectorAll('else')];
        if_statments.forEach(if_statment_el => {
          // check if children
          let has_children = [...if_statment_el.querySelectorAll('else')];
          if (!has_children.length > 0) {
            while (if_statment_el.attributes.length > 0)
              if_statment_el.removeAttribute(if_statment_el.attributes[0].name);
            let if_html = if_statment_el.outerHTML;
            if_statment_el.outerHTML = if_html
              .replace('<else>', `\ else { return \``)
              .replace('</else>', `\` } return '' })() }`);
          }
        });
      }

      // lifecycle scripts ================================================
      while ([...compontent_html.querySelectorAll('script[update], script[render]')].length > 0) {
        let scripts = [...compontent_html.querySelectorAll('script[update], script[render]')];
        scripts.forEach(script => {
          let script_type = script.attributes[0].name;
          while (script.attributes.length > 0)
            script.removeAttribute(script.attributes[0].name);
          let script_html = script.outerHTML;
          if (script_type === 'update') {
            script_html = script_html
              .replace('<script>', '${/*update*/\n(() => { setTimeout(() => {')
              .replace('</script>', '}, 0); return ""})()}');
          } else if (script_type === 'render') {
            script_html = script_html
              .replace('<script>', '${/*render*/\n(() => {')
              .replace('</script>', '})()}');
          }
          script.outerHTML = script_html;
          script.remove();
        });
      }

      // main & mount scripts ============================================
      let script_text = '';
      let scripts = [...compontent_html.querySelectorAll("script")];
      scripts.forEach(script => {
        if (!script.attributes[0]) {
          script_text += compontent_html.querySelector("script").innerText;
          script.remove();
        } else if (script.attributes[0].name.indexOf('mount') > -1) {
          script_text += `$bay['$mounted'] = () => {${script.innerText}};`;
          script.remove();
        }
      });
      script = script_text;

      // apply passed attributes =========================================
      observedAttributes_from_element = attrs;

    } catch (error) {
      console.error(error);
    }
    if (!compontent_tagname) {
      window.top.document.title =
        '🔴' + file_name;
      console.error(
        'Somthing went wrong with loading the file ' + file_name + '.');
      return;
    }

    // create the component
    customElements.define(compontent_tagname, class extends HTMLElement {
      constructor() {
        super();
        this.mounted = false;
        this.template = document.createElement('template');
        this.original_template = '';
        this.uniqid = makeid(8);
        this.CSP_errors = false;
        this.original_template = `${compontent_html.innerHTML}`;
        this.dsd = false;

        if (this.shadowRoot) {
          const nodes = [...this.shadowRoot.children];
          const wrapper = document.createElement('div');
          wrapper.id = 'bay';
          nodes.map(node => wrapper.appendChild(node));
          this.shadowRoot.appendChild(wrapper);
          this.dsd = true;
        } else {
          this.attachShadow({
            mode: 'open'
          });
          this.template.innerHTML = /*HTML*/ `<div id="bay"></div>`;
          this.shadowRoot.appendChild(this.template.content.cloneNode(true));
          this.shadowRoot.querySelector("#bay").style.display = 'none';
        }

        // proxy setup
        var handler = {
          get(target, key) {
            if (key == 'isProxy') {
              return true;
            }
            const prop = target[key];
            if (typeof prop == 'undefined') {
              return;
            }
            if (prop == null) {
              return;
            }
            if (!prop.isProxy && typeof prop === 'object') {
              target[key] = new Proxy(prop, handler);
            }
            return target[key];
          },
          set: (target, key, value) => {
            target[key] = value;
            this.render();
            return true;
          }
        };
        var default_data = {};
        this.shadowRoot.proxy = new Proxy(default_data, handler);

        window.bay[this.uniqid] = this.shadowRoot;
        [...attrs].forEach(attr => {
          this.shadowRoot.proxy[attr.att] = attr.value;
        });

        window.bay[this.uniqid][element_name] = this;

        // ------------------------------------------------------------------------

        this.oldEvents = ``;

        if (!script) {
          script = "/* No script tag found */";
        }

        let proxy_script =
          `const ${local_name} = window.bay['${this.uniqid}'];\nconst ${store_name} = window.bay.global;\nconst ${element_name} = ${local_name}['${element_name}'];` +
          decodeHtml(script)
          .replaceAll('this[', `${local_name}.proxy[`)
          .replaceAll('this.', `${local_name}.proxy.`);
        let proxy_html =
          decodeHtml(this.original_template)
          .replaceAll('this[', `${local_name}.proxy[`)
          .replaceAll('this.', `${local_name}.proxy.`);
        let proxy_css = '';
        if (styles_text) {
          proxy_css =
            decodeHtml(styles_text)
            .replaceAll('"${', '${')
            .replaceAll("'${", '${')
            .replaceAll(`}"`, `}`)
            .replaceAll(`}'`, `}`)
            .replaceAll('this[', `${local_name}.proxy[`)
            .replaceAll('this.', `${local_name}.proxy.`)
            .replaceAll(`  `, ``)
            .replaceAll('\n', ``);
        }

        this.add_JS_BlobFileToHead(
          `{"use strict";\n${proxy_script}\n${local_name}.template = () => { return \`${proxy_html}\`;};\n${local_name}.styles = () => { return \`${proxy_css}\`;};\n};`
        );

        this.hasAdoptedStyleSheets = false;
        if ('adoptedStyleSheets' in document) {
          this.hasAdoptedStyleSheets = true;
        }
        if (this.hasAdoptedStyleSheets) {
          this.sheet = new CSSStyleSheet();
          this.sheet.replaceSync(proxy_css);
          this.shadowRoot.adoptedStyleSheets = [this.sheet];
        } else {
          var blob = new Blob([proxy_css], {
            type: 'text/css'
          });
          var blobUrl = URL.createObjectURL(blob);
          var styleLink = document.createElement('link');
          styleLink.rel = 'stylesheet';
          styleLink.href = blobUrl;
          this.shadowRoot.appendChild(styleLink);
          styleLink.id = 'bay-style';
          var styleLinkUpdate = document.createElement('link');
          styleLinkUpdate.id = 'bay-style-update';
          styleLinkUpdate.href = blobUrl;
          styleLinkUpdate.rel = 'stylesheet';
          this.shadowRoot.appendChild(styleLinkUpdate);
          this.styleLinkUpdate = styleLinkUpdate;
        }
      }

      /**
       * https://gomakethings.com/mit/
       * Credit to Chris Ferdinandi for these great functions
       */

      stringToHTML(str) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(str, 'text/html');
        return doc.body;
      }

      getNodeType(node) {
        if (node.nodeType === 3) return 'text';
        if (node.nodeType === 8) return 'comment';
        return node.tagName.toLowerCase();
      }

      getNodeContent(node) {
        if (node.childNodes && node.childNodes.length > 0) return null;
        return node.textContent;
      }

      dom_diff(template, elem) {
        var domNodes = Array.prototype.slice.call(elem.childNodes);
        var templateNodes = Array.prototype.slice.call(template.childNodes);
        var count = domNodes.length - templateNodes.length;
        if (count > 0) {
          for (; count > 0; count--) {
            domNodes[domNodes.length - count].parentNode.removeChild(domNodes[domNodes.length - count]);
          }
        }
        templateNodes.forEach((template_node, index) => {
          if (!domNodes[index]) {
            elem.appendChild(template_node.cloneNode(true));
            return;
          }
          if (this.getNodeType(template_node) !== this.getNodeType(domNodes[index])) {
            try {
              domNodes[index].parentNode.replaceChild(template_node.cloneNode(true), domNodes[index]);
            } catch (error) {}
            return;
          }
          var templateContent = this.getNodeContent(template_node);
          if (templateContent && templateContent !== this.getNodeContent(domNodes[index])) {
            domNodes[index].textContent = templateContent;
          }
          if (domNodes[index].childNodes.length > 0 && template_node.childNodes.length < 1) {
            domNodes[index].innerHTML = '';
            return;
          }
          if (domNodes[index].childNodes.length < 1 && template_node.childNodes.length > 0) {
            var fragment = document.createDocumentFragment();
            this.dom_diff(template_node, fragment);
            domNodes[index].appendChild(fragment);
            return;
          }
          if (template_node.childNodes.length > 0) {
            this.dom_diff(template_node, domNodes[index]);
          }
        });
      }

      // ===================================================
      copyAttributes(source, target) {
        return [...source.attributes].forEach(attribute => {
          if (attribute.nodeName === 'value') {
            if (target.value !== attribute.value) {
              target.value = attribute.value;
            }
          }
          if (
            !target.getAttribute(attribute.nodeName) ||
            target.getAttribute(attribute.nodeName) !== attribute.value
          ) {
            target.setAttribute(attribute.nodeName, attribute.value);
          }
        });
      }

      add_events_and_styles(element) {
        let this_newEvents = ``;
        [...element.querySelectorAll("*")].forEach((el, i) => {
          let attrs = el.attributes;
          [...attrs].forEach(attr => {
            let event = (attr.name.substring(0, 1) === ':');
            if (event) {
              if (attr.name.indexOf(':style') > -1) {
                let style_obj = {};
                let style_vals = attr.value.split(';') || [attr.value];
                style_vals.map((style) => {
                  let style_val = style.split(':');
                  if (style_val[0] && style_val[1]) {
                    style_obj[style_val[0].trim()] = style_val[1].trim();
                  }
                });
                Object.assign(el.style, style_obj);
              } else {
                let attr_data = attr.value.replaceAll('window.bay', `${local_name}`);
                if (this_newEvents.indexOf(`${local_name}['${i}'] = {};`) === -1) {
                  this_newEvents += `${local_name}['${i}'] = {};`;
                }
                this_newEvents += `${local_name}['${i}']['${attr.name}'] = function(e) {${attr_data}};`;
                el[`on${attr.name.split(':')[1]}`] = (e) => {
                  if (
                    window.bay[this.uniqid][`${i}`] &&
                    window.bay[this.uniqid][`${i}`][`${attr.name}`]
                  ) {
                    window.bay[this.uniqid][`${i}`][attr.name](e);
                  }
                };
              }
            }
          });
        });
        if (this_newEvents && this.oldEvents !== this_newEvents) {
          this.oldEvents = this_newEvents;
          this.add_JS_Blob_event(this_newEvents);
        }
      }

      // constructed styles
      set_styles() {
        let new_styles = window.bay[this.uniqid][`styles`]();
        if (this.oldStyles !== new_styles) {
          this.oldStyles = new_styles;
          if (this.hasAdoptedStyleSheets) {
            this.sheet.replaceSync(new_styles);
          } else {
            // safari
            var blob = new Blob([new_styles], {
              type: 'text/css'
            });
            var blobUrl = URL.createObjectURL(blob);
            this.styleLinkUpdate.href = blobUrl;
            URL.revokeObjectURL(blobUrl);
          }
        }
      }

      /**
       * Renders the component from proxy data changes
       */

      render() {
        if (this.CSP_errors) {
          this.shadowRoot.innerHTML = '';
          return;
        }
        if (
          !this.original_template ||
          !this.shadowRoot.querySelector("#bay").innerHTML
        ) {
          return;
        }
        if (typeof window.bay[this.uniqid].template !== "function") { 
          return;
        }
        try {
          // Diff the DOM and template
          var templateHTML = this.stringToHTML(window.bay[this.uniqid].template());
          var shadowHTML = this.shadowRoot.querySelector("#bay");
          this.dom_diff(templateHTML, shadowHTML);
          let all_template_elements = [...templateHTML.querySelectorAll("*")];
          let all_shadow_elements = [...shadowHTML.querySelectorAll("*")];
          all_template_elements.forEach((el, i) => {
            let is_equal = all_shadow_elements[i].isEqualNode(el);
            if (!is_equal) {
              if (all_shadow_elements[i]) {
                this.copyAttributes(el, all_shadow_elements[i]);
              }
            }
          });
          this.add_events_and_styles(shadowHTML);
          this.set_styles();
          if (
            this.mounted === false &&
            window.bay[this.uniqid]['$mounted']
          ) {
            this.mounted = true;
            setTimeout(() => {
              window.bay[this.uniqid]['$mounted']();
            }, 14);
          }
          if (this.shadowRoot.querySelector('[bay]')) {
            get_all_bays(this.shadowRoot);
          }
        } catch (error) {
          console.error(error);
        }
      }

      add_JS_Blob_event(text) {
        let blob_text = `{"use strict";const ${local_name} = window.bay['${this.uniqid}'];const ${store_name} = window.bay.global;${text}};`;
        var blob = new Blob([blob_text], {
          type: 'text/javascript'
        });
        var blobUrl = URL.createObjectURL(blob);
        var newScript = document.createElement('script');
        newScript.type = 'text/javascript';
        newScript.src = blobUrl;
        this.shadowRoot.appendChild(newScript);
        newScript.onload = () => {
          URL.revokeObjectURL(blobUrl);
          newScript.remove();
        };
      }

      add_JS_BlobFileToHead(text) {
        document.addEventListener("securitypolicyviolation", (e) => {
          e.preventDefault();
          if (e.violatedDirective.indexOf('script-src') > -1) {
            if (e.blockedURI === 'blob') {
              console.warn('blob: needed in script-src CSP');
              this.CSP_errors = true;
            }
          }
          if (e.violatedDirective.indexOf('style-src') > -1) {
            if (e.blockedURI === 'blob') {
              console.warn('blob: needed in style-src CSP');
              this.CSP_errors = true;
            }
          }
        });
        var blob = new Blob([text], {
          type: 'text/javascript'
        });
        var blobUrl = URL.createObjectURL(blob);
        var newScript = document.createElement('script');
        newScript.type = 'text/javascript';
        newScript.src = blobUrl;
        this.shadowRoot.appendChild(newScript);
        newScript.onload = () => {
          URL.revokeObjectURL(blobUrl);
          if(!this.dsd){
            this.original_template = window.bay[this.uniqid].template();
            this.shadowRoot.getElementById('bay').innerHTML = this.original_template;
          }
          this.render();
          newScript.remove();
          if (this.CSP_errors) {
            this.shadowRoot.innerHTML = 'CSP issue, add blob: to script-src & style-src whitelist.';
            return;
          } else {
            this.shadowRoot.getElementById('bay').style.display = '';
            if (this.shadowRoot.querySelector('[bay]')) {
              get_all_bays(this.shadowRoot);
            }
          }
        };
      }

      connectedCallback() {
        try {
          window.addEventListener('bay_global_event', (e) => {
            this.render();
          });

        } catch (error) {
          console.error(error);
        }
      }
      static get observedAttributes() {
        return observedAttributes_from_element;
      }
      attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
          this.shadowRoot.proxy[name] = newValue;
        }
      }
    });
  }
  window.onload = () => {
    get_all_bays(document);
  };

  bay.refresh = () => {
    get_all_bays(document);
  };
};

if (typeof exports != "undefined") {
  exports.default = bay;
} else {
  bay();
}