const bay = () => {
  "use strict";

  /**
   * Used to attach shadow roots to templates with the shadowroot attribute
   * @param {HTMLElement} root
   */
  (function attachShadowRoots(root) {
    root.querySelectorAll("template[shadowroot]").forEach((template) => {
      const mode = template.getAttribute("shadowroot");
      const shadowRoot = template.parentNode.attachShadow({ mode });
      shadowRoot.appendChild(template.content);
      template.remove();
      attachShadowRoots(shadowRoot);
    });
  })(document);
  // ------------------------------

  window.bay = {};
  const local_name = "$bay";
  const store_name = "$global";
  const element_name = "$el";
  let file_name = "";
  let to_fetch = [];
  let already_fetched = [];

  /**
   * Tells other components using $global that the global data has changed.
   */
  function dispatch_global_event() {
    const evt = new CustomEvent("bay_global_event");
    window.dispatchEvent(evt);
  }
  // ------------------------------

  /**
   * Escapes HTML characters in a string to prevent XSS attacks when added data to proxys.
   * @param {any} input string to be escaped
   */
  const escape = document.createElement("textarea");
  function escapeHTML(input) {
    if (typeof input === "string") {
      escape.textContent = input;
      return escape.innerHTML
        .replaceAll(`"`, `&quot;`)
        .replaceAll(`'`, `&#39;`);
    }
    return input;
  }
  // ------------------------------

  /**
   * Global data object that can be accessed by all components.
   */
  if (!window.bay.global) {
    const global_data = {};
    const global_handler = {
      get(target, key) {
        if (key == "isProxy") {
          return true;
        }
        const prop = target[key];
        if (typeof prop == "undefined") {
          return;
        }
        if (prop == null) {
          return;
        }
        if (!prop.isProxy && typeof prop === "object") {
          target[key] = new Proxy(prop, global_handler);
        }
        return target[key];
      },
      set: (target, key, value) => {
        target[key] = escapeHTML(value);
        dispatch_global_event();
        return true;
      },
    };
    window.bay.global = new Proxy(global_data, global_handler);
  }
  // ------------------------------

  /**
   * Generates a random string to be used as a unique ID.
   * @param {number} length length of the string to be generated
   */
  function makeid(length) {
    let result = "";
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
  // ------------------------------

  /**
   * Decodes HTML entities in a string.
   * @param {string} html string to be decoded
   */
  function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  }
  // ------------------------------

  /**
   * Finds all custom elements on the page with the attribute "bay"
   * adds them to an array and then fires fetch_component on non dupes.
   * @param {HTMLElement} element root element
   */
  function get_all_bays(element) {
    const bays = [...element.querySelectorAll("[bay]")];
    bays.forEach((el, i) => {
      if (el.getAttribute("bay") === "dsd") {
        el.setAttribute("bay", `dsd-${i}`);
      }
      let attr = el.getAttribute("bay");
      if (to_fetch.indexOf(attr) === -1) {
        to_fetch.push(el);
      }
    });
    to_fetch.forEach((el) => {
      if (already_fetched.indexOf(el.getAttribute("bay")) === -1) {
        fetch_component(el);
      }
      already_fetched.push(el.getAttribute("bay"));
    });
  }
  // ------------------------------

  /**
   * makes changes to the template before its passed to create_component.
   * @param {HTMLElement} template_el template element
   * @param {HTMLElement} bay bay custom element tag
   */
  function modify_template(template_el, bay) {
    const doc = new DOMParser();
    let html;
    let styles_text;
    if (template_el.indexOf("<style>") > -1) {
      styles_text = template_el.split("<style>")[1].split("</style>")[0];
    }
    template_el = template_el
      .replaceAll(/<!--[\s\S]*?-->/g, "")
      .replaceAll(`<style>${styles_text}</style>`, "");
    html = doc.parseFromString(template_el, "text/html");
    if (html) {
      if (!customElements.get(bay.tagName.toLowerCase())) {
        create_component(
          html,
          bay.tagName.toLowerCase(),
          getAttributes(bay),
          styles_text
        );
      }
    }
  }
  // ------------------------------

  /**
   * Creates a custom element from a template invoked via function.
   * @param {String} element_tagname custom element tagname
   * @param {String} template_string template string
   * @param {Array} attributes_array array of attributes to be added to the custom element
   */
  function create_template_fn(
    element_tagname,
    template_string,
    attributes_array
  ) {
    const doc = new DOMParser();
    let html;
    let styles_text;
    let passed_attributes = attributes_array || [];
    if (template_string.indexOf("<style>") > -1) {
      styles_text = template_string.split("<style>")[1].split("</style>")[0];
    }
    template_string = template_string
      .replaceAll(/<!--[\s\S]*?-->/g, "")
      .replaceAll(`<style>${styles_text}</style>`, "");
    html = doc.parseFromString(template_string, "text/html");
    if (html) {
      if (!customElements.get(element_tagname.toLowerCase())) {
        create_component(
          html,
          element_tagname.toLowerCase(),
          passed_attributes,
          styles_text
        );
      }
    }
  }
  // ------------------------------

  /**
   * Get the template from the bay element and pass it to modify_template.
   * @param {String} bay location of the template, dsd, url or id.
   * dsd = bay="dsd" will fetch the template from within the bay element itself
   * the template needs shadowroot="open".
   * url = bay="https://example.com/template.html" will fetch the template from the url.
   * id = bay="#template" will fetch the template from the id
   */
  function fetch_component(bay) {
    try {
      const location = bay.getAttribute("bay");
      if (location.substring(0, 4) === "dsd-") {
        file_name = location;
        if (!bay.shadowRoot) {
          modify_template(
            decodeHtml(bay.querySelector("template").innerHTML),
            bay
          );
        } else {
          modify_template(decodeHtml(bay.shadowRoot.innerHTML), bay);
        }
      } else if (location.substring(0, 1) === "#") {
        file_name = location;
        const template_el = document.querySelector(location);
        if (!template_el) {
          console.error(
            `bay: "${location}" no element found with this selector.`
          );
          return;
        }
        modify_template(template_el.innerHTML, bay);
      } else {
        const request = new XMLHttpRequest();
        request.open("GET", location);
        request.setRequestHeader("Content-Type", "text/plain");
        request.addEventListener("load", (event) => {
          modify_template(event.target.responseText, bay);
        });
        request.addEventListener("error", () => {
          console.error(
            "For CORS policy errors try this: https://stackoverflow.com/questions/10752055/cross-origin-requests-are-only-supported-for-http-error-when-loading-a-local"
          );
        });
        request.send();
      }
    } catch (error) {
      console.error(error);
    }
  }
  // ------------------------------

  /**
   * Get the attributes from the bay element.
   * @param {HTMLElement} bay bay custom element tag
   */
  function getAttributes(bay) {
    let all_attrs = [];
    const this_attrs = [...bay.attributes];
    this_attrs.forEach((attr) => {
      if (attr.name !== "bay" && all_attrs.indexOf(attr.name) === -1) {
        all_attrs.push(attr.name);
      }
    });
    return all_attrs;
  }
  // ------------------------------

  /** =============================
   * https://gomakethings.com/mit/
   * Credit to Chris Ferdinandi for these great functions
   * create HTML from string
   * @param {string} str
   * @returns
   */
  function stringToHTML(str) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, "text/html");
    return doc.body;
  }

  /**
   * return the tagname of the node
   * @param {HTMLElement} node
   */
  function getNodeType(node) {
    if (node.nodeType === 3) return "text";
    if (node.nodeType === 8) return "comment";
    return node.tagName.toLowerCase();
  }

  /**
   * return the text content of the node
   * @param {HTMLElement} node
   */
  function getNodeContent(node) {
    if (node.childNodes && node.childNodes.length > 0) return null;
    return node.textContent;
  }

  /**
   * diff the dom and the template
   * @param {HTMLElement} template
   * @param {HTMLElement} elem
   */
  function dom_diff(template, elem) {
    const domNodes = Array.prototype.slice.call(elem.childNodes);
    const templateNodes = Array.prototype.slice.call(template.childNodes);
    let count = domNodes.length - templateNodes.length;
    if (count > 0) {
      for (; count > 0; count--) {
        domNodes[domNodes.length - count].parentNode.removeChild(
          domNodes[domNodes.length - count]
        );
      }
    }
    templateNodes.forEach((template_node, index) => {
      if (!domNodes[index]) {
        elem.appendChild(template_node.cloneNode(true));
        return;
      }
      if (getNodeType(template_node) !== getNodeType(domNodes[index])) {
        try {
          domNodes[index].parentNode.replaceChild(
            template_node.cloneNode(true),
            domNodes[index]
          );
        } catch (error) {}
        return;
      }
      const templateContent = getNodeContent(template_node);
      if (
        templateContent &&
        templateContent !== getNodeContent(domNodes[index])
      ) {
        domNodes[index].textContent = templateContent;
      }
      if (
        domNodes[index].childNodes.length > 0 &&
        template_node.childNodes.length < 1
      ) {
        domNodes[index].innerHTML = "";
        return;
      }
      if (
        domNodes[index].childNodes.length < 1 &&
        template_node.childNodes.length > 0
      ) {
        const fragment = document.createDocumentFragment();
        dom_diff(template_node, fragment);
        domNodes[index].appendChild(fragment);
        return;
      }
      if (template_node.childNodes.length > 0) {
        dom_diff(template_node, domNodes[index]);
      }
    });
  }
  /** ============================= */

  /**
   * copy attributes from template to shadow
   * @param {HTMLElement} template
   * @param {HTMLElement} shadow
   */
  function copyAttributes(template, shadow) {
    [...shadow.attributes].forEach((attribute) => {
      if (!template.value) {
        shadow.value = "";
      }
      if (!template.checked) {
        shadow.checked = false;
      }
      if (!template.selected) {
        shadow.selected = false;
      }
      if (!template.disabled) {
        shadow.disabled = false;
      }
      if (!template.getAttribute(attribute.nodeName)) {
        shadow.removeAttribute(attribute.nodeName);
      }
    });
    [...template.attributes].forEach((attribute) => {
      if (shadow.value !== template.value) {
        shadow.value = template.value;
      }
      if (shadow.checked !== template.checked) {
        shadow.checked = template.checked;
      }
      if (shadow.selected !== template.selected) {
        shadow.selected = template.selected;
      }
      if (shadow.disabled !== template.disabled) {
        shadow.disabled = template.disabled;
      }
      if (
        !shadow.getAttribute(attribute.nodeName) ||
        shadow.getAttribute(attribute.nodeName) !== attribute.value
      ) {
        shadow.setAttribute(attribute.nodeName, attribute.value);
      }
    });
  }

  /**
   * Create a custom element from a template.
   * @param {HTMLElement} html html element
   * @param {String} element_tagname custom element tagname
   * @param {Array} attrs array of attributes to be added to the custom element
   * @param {String} styles_text css styles
   */
  function create_component(html, element_tagname, attrs, styles_text) {
    let component_tagname = "";
    let component_html = "";
    let script;
    let observedAttributes_from_element;
    let has_globals = false;
    try {
      // html ====================================================
      component_html = html.body;
      component_tagname = element_tagname;

      // Add update element ======================================
      const update_el = document.createElement(`${element_tagname}-update`);
      component_html.appendChild(update_el);

      // detect if has globals ===================================
      if (
        component_html.innerHTML.indexOf("$global.") > -1 ||
        component_html.innerHTML.indexOf("$global[") > -1
      ) {
        has_globals = true;
      }

      /**
       * Following while loops replace custom tags with the equivalent javascript code
       *
       * dsds
       * declarative shadow dom, https://web.dev/declarative-shadow-dom/
       * content in the dsd tags are loaded before the component is rendered
       * then removed from the DOM, noscript tags are unwrapped.
       */
      while ([...component_html.querySelectorAll("dsd")].length > 0) {
        const dsds = [...component_html.querySelectorAll("dsd")];
        dsds.forEach((dsd_el) => {
          dsd_el.remove();
        });
      }
      component_html.innerHTML = component_html.innerHTML
        .replaceAll("<noscript>", "")
        .replaceAll("</noscript>", "");

      /**
       * maps
       * replace map tags with the equivalent javascript code
       * has extra join attribute
       */
      while ([...component_html.querySelectorAll("map")].length > 0) {
        const maps = [...component_html.querySelectorAll("map")];
        maps.forEach((map_el) => {
          const has_children = map_el.querySelector("map");
          if (!has_children) {
            const map_array = map_el.getAttribute("array") || [];
            const map_params =
              map_el.getAttribute("params") || "element, index, array";
            const map_join = map_el.getAttribute("join") || "";
            while (map_el.attributes.length > 0)
              map_el.removeAttribute(map_el.attributes[0].name);
            let map_html = map_el.outerHTML;
            map_html = map_html
              .replace(
                "<map>",
                `\${ ${map_array}.map((${map_params}) => { return \``
              )
              .replace("</map>", `\`}).join('${map_join}')}`);
            map_el.outerHTML = map_html;
          }
        });
      }

      /**
       * fors
       * replace for tags with the equivalent javascript code
       */
      while ([...component_html.querySelectorAll("for")].length > 0) {
        const fors = [...component_html.querySelectorAll("for")];
        fors.forEach((for_el) => {
          const has_children = for_el.querySelector("for");
          if (!has_children) {
            const this_for = `bay_for_${makeid(8)}`;
            const for_array = for_el.getAttribute("array") || [];
            const for_params =
              for_el.getAttribute("params") || "element, index, array";
            while (for_el.attributes.length > 0)
              for_el.removeAttribute(for_el.attributes[0].name);
            let for_html = for_el.outerHTML;
            for_html = for_html
              .replace(
                "<for>",
                `\${(() => { let ${this_for} = ''; ${for_array}.forEach((${for_params}) => { ${this_for} += \``
              )
              .replace("</for>", `\`}); return ${this_for}; })() }`);
            for_el.outerHTML = for_html;
          }
        });
      }

      /**
       * if's
       * replace if tags with the equivalent javascript code
       * if children tags are replaced first before the parent
       * if the if tag is followed by a else-if or else tag then the
       * brackets are left open for them and closed in else-if or else tag
       */
      while ([...component_html.querySelectorAll("if")].length > 0) {
        const if_statements = [...component_html.querySelectorAll("if")];
        if_statements.forEach((if_statement_el) => {
          const has_children = [...if_statement_el.querySelectorAll("if")];
          if (!has_children.length > 0) {
            const statement = [...if_statement_el.attributes][0]
              ? [...if_statement_el.attributes][0].nodeValue
              : "";
            const next_el = if_statement_el.nextElementSibling
              ? if_statement_el.nextElementSibling.tagName.toLowerCase()
              : "";
            while (if_statement_el.attributes.length > 0)
              if_statement_el.removeAttribute(
                if_statement_el.attributes[0].name
              );
            let if_html = if_statement_el.outerHTML;
            let close_func = `\` } return '' })() }`;
            if (next_el === "else-if" || next_el === "else") {
              close_func = `\` }`;
            }
            if_statement_el.outerHTML = if_html
              .replace("<if>", `\${(() => { if (${statement}) { return \``)
              .replace("</if>", close_func);
          }
        });
      }

      // else-if's ====================================================
      while ([...component_html.querySelectorAll("else-if")].length > 0) {
        const if_statements = [...component_html.querySelectorAll("else-if")];
        if_statements.forEach((if_statement_el) => {
          const has_children = [...if_statement_el.querySelectorAll("else-if")];
          if (!has_children.length > 0) {
            const statement = [...if_statement_el.attributes][0]
              ? [...if_statement_el.attributes][0].nodeValue
              : "";
            const next_el = if_statement_el.nextElementSibling
              ? if_statement_el.nextElementSibling.tagName.toLowerCase()
              : "";
            while (if_statement_el.attributes.length > 0)
              if_statement_el.removeAttribute(
                if_statement_el.attributes[0].name
              );
            let if_html = if_statement_el.outerHTML;
            let close_func = `\` } return '' })() }`;
            if (next_el === "else-if" || next_el === "else") {
              close_func = `\` }`;
            }
            if_statement_el.outerHTML = if_html
              .replace("<else-if>", `\ else if (${statement}) { return \``)
              .replace("</else-if>", close_func);
          }
        });
      }

      // else's ====================================================
      while ([...component_html.querySelectorAll("else")].length > 0) {
        const if_statements = [...component_html.querySelectorAll("else")];
        if_statements.forEach((if_statement_el) => {
          const has_children = [...if_statement_el.querySelectorAll("else")];
          if (!has_children.length > 0) {
            while (if_statement_el.attributes.length > 0)
              if_statement_el.removeAttribute(
                if_statement_el.attributes[0].name
              );
            let if_html = if_statement_el.outerHTML;
            if_statement_el.outerHTML = if_html
              .replace("<else>", `\ else { return \``)
              .replace("</else>", `\` } return '' })() }`);
          }
        });
      }

      /**
       * switch's
       * replace switch tags with the equivalent javascript code
       */
      while ([...component_html.querySelectorAll("switch")].length > 0) {
        const switch_statements = [
          ...component_html.querySelectorAll("switch"),
        ];
        switch_statements.forEach((switch_statement_el) => {
          const has_children = [
            ...switch_statement_el.querySelectorAll("switch"),
          ];
          if (!has_children.length > 0) {
            const statement = [...switch_statement_el.attributes][0]
              ? [...switch_statement_el.attributes][0].nodeValue
              : "";
            while (switch_statement_el.attributes.length > 0)
              switch_statement_el.removeAttribute(
                switch_statement_el.attributes[0].name
              );
            let switch_html = switch_statement_el.outerHTML;
            switch_statement_el.outerHTML = switch_html
              .replace("<switch>", `\${(() => { switch (${statement}) { `)
              .replace("</switch>", ` }; return '' })() }`);
          }
        });
      }

      /**
       * case's
       * nest inside switch
       * replace case tags with the equivalent javascript code
       * if break attribute is present, add break; to the end of the case statement
       * if tag is empty and does not contain a break it will continue to the next case
       */
      while ([...component_html.querySelectorAll("case")].length > 0) {
        const case_statements = [...component_html.querySelectorAll("case")];
        case_statements.forEach((case_statement_el) => {
          const has_children = [...case_statement_el.querySelectorAll("case")];
          if (!has_children.length > 0) {
            const break_prop = case_statement_el.hasAttribute("break")
              ? "break;"
              : "";
            if (break_prop) {
              case_statement_el.removeAttribute("break");
            }
            const shared_case = case_statement_el.innerHTML;
            const statement = [...case_statement_el.attributes][0]
              ? [...case_statement_el.attributes][0].nodeValue
              : "";
            while (case_statement_el.attributes.length > 0)
              case_statement_el.removeAttribute(
                case_statement_el.attributes[0].name
              );
            let case_html = case_statement_el.outerHTML;
            if (shared_case.length === 0) {
              case_statement_el.outerHTML = case_html
                .replace("<case>", `case ${statement}:`)
                .replace("</case>", ` ` + break_prop);
            } else {
              case_statement_el.outerHTML = case_html
                .replace("<case>", `case ${statement}: return \``)
                .replace("</case>", `\`; ` + break_prop);
            }
          }
        });
      }

      /**
       * default's
       * nest inside switch
       * default case for switch
       */
      while ([...component_html.querySelectorAll("default")].length > 0) {
        const default_statements = [
          ...component_html.querySelectorAll("default"),
        ];
        default_statements.forEach((default_statement_el) => {
          const has_children = [
            ...default_statement_el.querySelectorAll("default"),
          ];
          if (!has_children.length > 0) {
            while (default_statement_el.attributes.length > 0)
              default_statement_el.removeAttribute(
                default_statement_el.attributes[0].name
              );
            let default_html = default_statement_el.outerHTML;
            default_statement_el.outerHTML = default_html
              .replace("<default>", `default: return \``)
              .replace("</default>", `\`;`);
          }
        });
      }

      /**
       * lifecycle scripts
       * replace script tags with the equivalent javascript code
       * script tags with update attribute will be wrapped in a setTimeout iife
       * script tags with render attribute will be wrapped in a function iife
       */
      while (
        [...component_html.querySelectorAll("script[update], script[render]")]
          .length > 0
      ) {
        const scripts = [
          ...component_html.querySelectorAll("script[update], script[render]"),
        ];
        scripts.forEach((script) => {
          const script_type = script.attributes[0].name;
          while (script.attributes.length > 0)
            script.removeAttribute(script.attributes[0].name);
          let script_html = script.outerHTML;
          if (script_type === "update") {
            script_html = script_html
              .replace("<script>", "${/*update*/\n(() => { setTimeout(() => {")
              .replace("</script>", '}, 0); return ""})()}');
          } else if (script_type === "render") {
            script_html = script_html
              .replace("<script>", "${/*render*/\n(() => {")
              .replace("</script>", "})()}");
          }
          script.outerHTML = script_html;
          script.remove();
        });
      }

      // main & mount scripts ============================================

      /**
       * main script
       * replace script tags with the equivalent javascript code
       * script tags with mount attribute will only be fired when the component is mounted
       */
      let script_text = "";
      const main_mount_scripts = [...component_html.querySelectorAll("script")];
      main_mount_scripts.forEach((script) => {
        if (!script.attributes[0]) {
          script_text += component_html.querySelector("script").innerText;
          script.remove();
        } else if (script.attributes[0].name.indexOf("mount") > -1) {
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
    if (!component_tagname) {
      window.top.document.title = "🔴" + file_name;
      console.error(
        "Somthing went wrong with loading the file " + file_name + "."
      );
      return;
    }

    // create the component
    customElements.define(
      component_tagname,
      class extends HTMLElement {
        constructor() {
          super();
          this.mounted = false;
          this.template = document.createElement("template");
          this.original_template = `${component_html.innerHTML}`;
          this.uniqid = makeid(8);
          this.CSP_errors = false;
          this.dsd = false;
          this.debouncer = false;

          // shadow dom setup ===============================================
          if (this.shadowRoot) {
            const nodes = [...this.shadowRoot.children];
            const wrapper = document.createElement("div");
            wrapper.id = "bay";
            nodes.map((node) => wrapper.appendChild(node));
            this.shadowRoot.appendChild(wrapper);
            this.dsd = true;
          } else {
            this.attachShadow({
              mode: "open",
            });
            this.template.innerHTML = /*HTML*/ `<div id="bay"></div>`;
            this.shadowRoot.appendChild(this.template.content.cloneNode(true));
            this.shadowRoot.querySelector("#bay").style.display = "none";
          }

          // local proxy setup =============================================
          var handler = {
            get(target, key) {
              if (key == "isProxy") {
                return true;
              }
              const prop = target[key];
              if (typeof prop == "undefined") {
                return;
              }
              if (prop == null) {
                return;
              }
              if (!prop.isProxy && typeof prop === "object") {
                target[key] = new Proxy(prop, handler);
              }
              return target[key];
            },
            set: (target, key, value) => {
              target[key] = escapeHTML(value);
              this.render_debouncer();
              return true;
            },
          };
          var default_data = {};
          this.shadowRoot.proxy = new Proxy(default_data, handler);

          window.bay[this.uniqid] = this.shadowRoot;
          [...attrs].forEach((attr) => {
            this.shadowRoot.proxy[attr.att] = attr.value;
          });

          window.bay[this.uniqid][element_name] = this;
          this.oldEvents = ``;

          // blob strings setup ============================================
          if (!script) {
            script = "/* No script tag found */";
          }
          let proxy_script =
            `const ${local_name} = window.bay['${this.uniqid}'];\nconst ${store_name} = window.bay.global;\nconst ${element_name} = ${local_name}['${element_name}'];` +
            decodeHtml(script)
              .replaceAll("this[", `${local_name}.proxy[`)
              .replaceAll("this.", `${local_name}.proxy.`);
          let proxy_html = decodeHtml(this.original_template)
            .replaceAll("this[", `${local_name}.proxy[`)
            .replaceAll("this.", `${local_name}.proxy.`);
          let proxy_css = "";
          if (styles_text) {
            proxy_css = decodeHtml(styles_text)
              .replaceAll('"${', "${")
              .replaceAll("'${", "${")
              .replaceAll(`}"`, `}`)
              .replaceAll(`}'`, `}`)
              .replaceAll("this[", `${local_name}.proxy[`)
              .replaceAll("this.", `${local_name}.proxy.`)
              .replaceAll(`  `, ``)
              .replaceAll("\n", ``);
          }

          this.add_JS_BlobFileToHead(
            `{"use strict";\n${proxy_script}\n${local_name}.template = () => { return \`${proxy_html}\`;};\n${local_name}.styles = () => { return \`${proxy_css}\`;};\n};`
          );

          this.hasAdoptedStyleSheets = false;
          if ("adoptedStyleSheets" in document) {
            this.hasAdoptedStyleSheets = true;
          }
          if (this.hasAdoptedStyleSheets) {
            this.sheet = new CSSStyleSheet();
            this.sheet.replaceSync(proxy_css);
            this.shadowRoot.adoptedStyleSheets = [this.sheet];
          } else {
            const blob = new Blob([proxy_css], {
              type: "text/css",
            });
            let blobUrl = URL.createObjectURL(blob);
            let styleLink = document.createElement("link");
            styleLink.rel = "stylesheet";
            styleLink.href = blobUrl;
            this.shadowRoot.appendChild(styleLink);
            styleLink.id = "bay-style";
            let styleLinkUpdate = document.createElement("link");
            styleLinkUpdate.id = "bay-style-update";
            styleLinkUpdate.href = blobUrl;
            styleLinkUpdate.rel = "stylesheet";
            this.shadowRoot.appendChild(styleLinkUpdate);
            this.styleLinkUpdate = styleLinkUpdate;
          }
        }

        add_events_and_styles(element) {
          let this_newEvents = ``;
          [...element.querySelectorAll("*")].forEach((el, i) => {
            const attrs = el.attributes;
            [...attrs].forEach((attr) => {
              let event = attr.name.substring(0, 1) === ":";
              if (event) {
                if (attr.name.indexOf(":style") > -1) {
                  let style_obj = {};
                  let style_vals = attr.value.split(";") || [attr.value];
                  style_vals.map((style) => {
                    let style_val = style.split(":");
                    if (style_val[0] && style_val[1]) {
                      style_obj[style_val[0].trim()] = style_val[1].trim();
                    }
                  });
                  Object.assign(el.style, style_obj);
                } else {
                  let attr_data = attr.value.replaceAll(
                    "window.bay",
                    `${local_name}`
                  );
                  if (
                    this_newEvents.indexOf(`${local_name}['${i}'] = {};`) === -1
                  ) {
                    this_newEvents += `${local_name}['${i}'] = {};`;
                  }
                  this_newEvents += `${local_name}['${i}']['${attr.name}'] = function(e) {${attr_data}};`;
                  el[`on${attr.name.split(":")[1]}`] = (e) => {
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
          const new_styles = window.bay[this.uniqid][`styles`]();
          if (this.oldStyles !== new_styles) {
            this.oldStyles = new_styles;
            if (this.hasAdoptedStyleSheets) {
              this.sheet.replaceSync(new_styles);
            } else {
              // safari
              var blob = new Blob([new_styles], {
                type: "text/css",
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

        render_debouncer() {
          if (this.debouncer) {
            window.cancelAnimationFrame(this.debouncer);
          }
          this.debouncer = window.requestAnimationFrame(() => {
            this.render();
          });
        }

        render() {
          if (this.CSP_errors) {
            this.shadowRoot.innerHTML = "";
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
            const templateHTML = stringToHTML(
              window.bay[this.uniqid].template()
            );
            const shadowHTML = this.shadowRoot.querySelector("#bay");
            dom_diff(templateHTML, shadowHTML);
            const all_template_elements = [
              ...templateHTML.querySelectorAll("*"),
            ];
            const all_shadow_elements = [...shadowHTML.querySelectorAll("*")];
            all_template_elements.forEach((el, i) => {
              const is_equal = all_shadow_elements[i].isEqualNode(el);
              if (!is_equal) {
                if (all_shadow_elements[i]) {
                  copyAttributes(el, all_shadow_elements[i]);
                }
              }
            });
            this.add_events_and_styles(shadowHTML);
            this.set_styles();
            if (this.mounted === false && window.bay[this.uniqid]["$mounted"]) {
              this.mounted = true;
              setTimeout(() => {
                window.bay[this.uniqid]["$mounted"]();
              }, 14);
            }
            if (this.shadowRoot.querySelector("[bay]")) {
              get_all_bays(this.shadowRoot);
            }
          } catch (error) {
            console.error(error);
          }
        }

        /**
         * this will create a blob file with all the events on the html (:click)
         * and add and is used to add the js in the attribute to memory
         */
        add_JS_Blob_event(text) {
          const blob_text = `{"use strict";const ${local_name} = window.bay['${this.uniqid}'];const ${store_name} = window.bay.global;${text}};`;
          const blob = new Blob([blob_text], {
            type: "text/javascript",
          });
          const blobUrl = URL.createObjectURL(blob);
          const newScript = document.createElement("script");
          newScript.type = "text/javascript";
          newScript.src = blobUrl;
          this.shadowRoot.appendChild(newScript);
          newScript.onload = () => {
            URL.revokeObjectURL(blobUrl);
            newScript.remove();
          };
        }

        /**
         * this will take all the html, scripts and styles make a blob file and add it to the head
         * once the blob file is loaded it will run the script and add the html to the shadow dom
         * the template function will return the html and the styles function will return the styles
         * this is used by the diff function to compare the old and new html and styles with updated data
         */
        add_JS_BlobFileToHead(text) {
          document.addEventListener("securitypolicyviolation", (e) => {
            e.preventDefault();
            if (e.violatedDirective.indexOf("script-src") > -1) {
              if (e.blockedURI === "blob") {
                console.warn("blob: needed in script-src CSP");
                this.CSP_errors = true;
              }
            }
            if (e.violatedDirective.indexOf("style-src") > -1) {
              if (e.blockedURI === "blob") {
                console.warn("blob: needed in style-src CSP");
                this.CSP_errors = true;
              }
            }
          });
          const blob = new Blob([text], {
            type: "text/javascript",
          });
          const blobUrl = URL.createObjectURL(blob);
          const newScript = document.createElement("script");
          newScript.type = "text/javascript";
          newScript.src = blobUrl;
          this.shadowRoot.appendChild(newScript);
          newScript.onload = () => {
            URL.revokeObjectURL(blobUrl);
            if (!this.dsd) {
              this.original_template = window.bay[this.uniqid].template();
              this.shadowRoot.getElementById("bay").innerHTML =
                this.original_template;
            }
            this.render_debouncer();
            newScript.remove();
            if (this.CSP_errors) {
              this.shadowRoot.innerHTML =
                "CSP issue, add blob: to script-src & style-src whitelist.";
              return;
            } else {
              this.shadowRoot.getElementById("bay").style.display = "";
              if (this.shadowRoot.querySelector("[bay]")) {
                get_all_bays(this.shadowRoot);
              }
            }
          };
        }

        connectedCallback() {
          try {
            if (has_globals) {
              window.addEventListener("bay_global_event", (e) => {
                this.render_debouncer();
              });
            }
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
      }
    );
  }
  // ------------------------------

  window.onload = () => {
    get_all_bays(document);
  };

  bay.refresh = () => {
    get_all_bays(document);
  };

  bay.create = create_template_fn;
};

if (typeof exports != "undefined") {
  exports.default = bay;
} else {
  bay();
}

// todo .mjs
//export default bay;
