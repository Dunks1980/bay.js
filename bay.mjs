const bay = () => {
  "use strict";

  const local_name = "$bay";
  const store_name = "$global";
  const element_name = "$el";
  window.bay = {};
  let file_name = "";
  let to_fetch = [];
  let already_fetched = [];

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
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replaceAll("-", "").substring(0, length);
    } else {
      let uuidv4 = () => {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
          (
            c ^
            (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
          ).toString(16)
        );
      };
      return uuidv4().replaceAll("-", "").substring(0, length);
    }
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
    let tagname = bay.tagName.toLowerCase();
    let start_split = "export default /*HTML*/`";
    if (template_el.startsWith(start_split)) {
      template_el = template_el.trim();
      template_el = template_el.split(start_split)[1];
      template_el = template_el.substring(0, template_el.length - 2);
      template_el = template_el.replaceAll("\\${", "${").replaceAll("\\`", "`");
    }
    if (template_el.indexOf("<style>") > -1) {
      styles_text = template_el.split("<style>")[1].split("</style>")[0];
    }
    template_el = template_el
      .replaceAll(/<!--[\s\S]*?-->/g, "")
      .replaceAll(`<style>${styles_text}</style>`, "");
    html = doc.parseFromString(template_el, "text/html");
    if (html) {
      if (!customElements.get(tagname)) {
        create_component(html, tagname, getAttributes(bay), styles_text);
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
          console.error(`Bay cannot find "${location}" selector.`);
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
        request.addEventListener("error", (error) => {
          console.error(error);
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
      if (
        attr.name !== "bay" &&
        attr.name !== "inner-html" &&
        all_attrs.indexOf(attr.name) === -1
      ) {
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
   * check if the attribute can be set via javascript
   * @param {HTMLElement} element
   * @param {string} attribute
   */
  function canSetAttribute(element, attribute) {
    if (
      typeof element[attribute] !== "undefined" &&
      typeof element[attribute] !== "object"
    ) {
      return true;
    }
    return false;
  }

  /**
   * copy attributes from template to shadow
   * @param {HTMLElement} template
   * @param {HTMLElement} shadow
   */
  function copyAttributes(template, shadow) {
    [...shadow.attributes].forEach((attribute) => {
      if (!template.hasAttribute(attribute.name)) {
        shadow.removeAttribute(attribute.nodeName);
        if (canSetAttribute(shadow, attribute.nodeName)) {
          delete shadow[attribute.nodeName];
        }
      }
    });
    [...template.attributes].forEach((attribute) => {
      if (
        !shadow.hasAttribute(attribute.nodeName) ||
        shadow.getAttribute(attribute.nodeName) !== attribute.value
      ) {
        shadow.setAttribute(attribute.nodeName, attribute.value);
      }
      if (canSetAttribute(shadow, attribute.nodeName)) {
        if (shadow[attribute.nodeName] !== attribute.value) {
          shadow[attribute.nodeName] = attribute.value;
        }
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
    let has_inner_html = false;
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
       * inner-html
       * replace inner-html tags with the equivalent javascript code
       * inserts the innerHTML of the tag into the parent element
       * within the bay element's tag, will replace any HTML already present
       */
      while ([...component_html.querySelectorAll("inner-html")].length > 0) {
        has_inner_html = true;
        const inner_htmls = [...component_html.querySelectorAll("inner-html")];
        inner_htmls.forEach((inner_html_el) => {
          while (inner_html_el.attributes.length > 0) {
            inner_html_el.removeAttribute(inner_html_el.attributes[0].name);
          }
          let inner_html_el_html = inner_html_el.outerHTML;
          inner_html_el_html = inner_html_el_html
            .replace("<inner-html>", "${ (() => { $bay_inner_html += `")
            .replace("</inner-html>", "`; return ''} )()}");
          inner_html_el.outerHTML = inner_html_el_html;
          inner_html_el.remove();
        });
      }

      /**
       * lifecycle scripts
       * replace script tags with the equivalent javascript code
       * script tags with update attribute will be wrapped in a setTimeout iife
       * script tags with render attribute will be wrapped in a function iife
       */
      while (
        [
          ...component_html.querySelectorAll(
            "script[update], script[render], script[props], script[slotchange]"
          ),
        ].length > 0
      ) {
        const scripts = [
          ...component_html.querySelectorAll(
            "script[update], script[render], script[props], script[slotchange]"
          ),
        ];
        scripts.forEach((script) => {
          const script_type = script.attributes[0].name;
          while (script.attributes.length > 0)
            script.removeAttribute(script.attributes[0].name);
          let script_html = script.outerHTML;
          switch (script_type) {
            case "update":
              script_html = script_html
                .replace("<script>", "${/*update*/ (() => {setTimeout(() => {")
                .replace("</script>", "}, 0); return ``})()}");
              break;
            case "props":
              script_html = script_html
                .replace(
                  "<script>",
                  "${ /*props updates*/ (() => {$props = () => {"
                )
                .replace("</script>", "};return ``})()}");
              break;
            case "render":
              script_html = script_html
                .replace("<script>", "${ /*render*/ (() => {")
                .replace("</script>", " return ``})()}");
              break;
            case "slotchange":
              script_html = script_html
                .replace(
                  "<script>",
                  "${ /*slotchange updates*/ (() => {$slotchange = (e) => { $details = e.detail;\n"
                )
                .replace("</script>", "};return ``})()}");
              break;
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
      console.error("Something went wrong loading file " + file_name + ".");
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
          this.blob_prefixes = "";
          this.blob_event_prefixes = "";

          const inner_html_target = this.getAttribute("inner-html");
          if (inner_html_target) {
            if (document.querySelector(inner_html_target)) {
              this.inner_html_target = document.querySelector(inner_html_target);
            } else {
              console.error(
                "inner-html target " + inner_html_target + " not found."
              );
            }
          } else {
            this.inner_html_target = this;
          }

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
              if (value === undefined) {
                return true;
              }
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
          this.oldEvents_inner_html = ``;

          // blob strings setup ============================================
          if (!script) {
            script = "/* No script tag found */";
          }

          // for getting the component's root element ======================
          this.shadowRoot.uniqid = this.uniqid;
          let rootNode = this.getRootNode();
          let parent_var = ``;
          if (rootNode.host) {
            parent_var = `const $parent = window.bay['${rootNode.host.uniqid}']['proxy'];\n`;
          }

          const local_var = `const ${local_name} = window.bay['${this.uniqid}'];\n`;
          const global_var = `const ${store_name} = window.bay.global;\n`;
          const element_var = `const ${element_name} = ${local_name}['${element_name}'];\n`;

          // add update function ===========================================
          this.local_update_evt = new CustomEvent(
            `bay_local_update_event_${this.uniqid}`
          );
          let update_func = ``;
          if (this.original_template.indexOf(`/*props updates*/`) > -1) {
            update_func = `let $props;\nwindow.addEventListener(\`bay_local_update_event_${this.uniqid}\`, () => $props());\n`;
          }

          // add slotchange function =======================================
          let slotchange_func = ``;
          if (this.original_template.indexOf(`/*slotchange updates*/`) > -1) {
            update_func = `let $slotchange = () => {};\nlet $details = {'element': '', 'changed': ''};\nwindow.addEventListener(\`bay_slotchange_event_${this.uniqid}\`, (e) => $slotchange(e));\n`;
          }

          // add decode & encode functions =================================
          window.bay.decode = decodeHtml;
          const decode_var = `$bay.decode = bay.decode;\n`;

          window.bay.encode = escapeHTML;
          const encode_var = `$bay.encode = bay.encode;\n`;

          // add slotchange event ==========================================
          window.bay[this.uniqid].addEventListener("slotchange", (e) => {
            this.local_slotchange_evt = new CustomEvent(
              `bay_slotchange_event_${this.uniqid}`,
              { detail: { element: e.target, changed: "slotchange" } }
            );
            window.dispatchEvent(this.local_slotchange_evt);
          });
          let bay_slots = this.querySelectorAll("*");
          bay_slots.forEach((slot) => {
            const slot_observer = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (mutation.type === "attributes") {
                  this.local_slotchange_evt = new CustomEvent(
                    `bay_slotchange_event_${this.uniqid}`,
                    { detail: { element: slot, changed: "attributes" } }
                  );
                  window.dispatchEvent(this.local_slotchange_evt);
                } else if (mutation.type === "childList") {
                  this.local_slotchange_evt = new CustomEvent(
                    `bay_slotchange_event_${this.uniqid}`,
                    { detail: { element: slot, changed: "childList" } }
                  );
                  window.dispatchEvent(this.local_slotchange_evt);
                }
              });
            });
            slot_observer.observe(slot, { attributes: true, childList: true });
          });

          // add inner-html vars ==========================================
          let inner_html_var = "";
          let inner_html_reset = "";
          let inner_html_fn = "";
          if (has_inner_html) {
            inner_html_var = `let $bay_inner_html = '';\n`;
            inner_html_reset = ` $bay_inner_html = ''; `;
            inner_html_fn = `\n$bay.inner_html = () => { return $bay_inner_html; };`;
          }

          this.blob_prefixes = `${local_var}${global_var}${element_var}${parent_var}${inner_html_var}${encode_var}${decode_var}${update_func}${slotchange_func}`;

          this.blob_event_prefixes = `${local_var}${global_var}${element_var}${parent_var}${encode_var}${decode_var}`;

          let proxy_script =
            `${this.blob_prefixes}` +
            decodeHtml(script)
              .replaceAll("this[", `${local_name}.proxy[`)
              .replaceAll("this.", `${local_name}.proxy.`)
              .replace(/(^[ \t]*\n)/gm, "");
          let proxy_html = decodeHtml(this.original_template)
            .replaceAll("this[", `${local_name}.proxy[`)
            .replaceAll("this.", `${local_name}.proxy.`)
            .replace(/(^[ \t]*\n)/gm, "");
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
            `${proxy_script}\n${local_name}.template = () => {${inner_html_reset}return \`${proxy_html}\`;};\n${local_name}.styles = () => { return \`${proxy_css}\`;};${inner_html_fn}`
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

        add_events_and_styles(element, inner_html) {
          if (!element) return;
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
                  this_newEvents += `${local_name}['${i}']['${attr.name}'] = function(e) {${attr_data}};\n`;
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
          if (inner_html) {
            if (this_newEvents && this.oldEvents_inner_html !== this_newEvents) {
              this.oldEvents_inner_html = this_newEvents;
              this.add_JS_Blob_event(this_newEvents);
            }
          } else {
            if (this_newEvents && this.oldEvents !== this_newEvents) {
              this.oldEvents = this_newEvents;
              this.add_JS_Blob_event(this_newEvents);
            }
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

        render_innerHTML(html_target) {
          if (html_target && typeof window.bay[this.uniqid].inner_html === "function") {
            const new_inner_html = stringToHTML(
              window.bay[this.uniqid].inner_html()
            );
            dom_diff(new_inner_html, html_target);
            const inner_html_elements = html_target.querySelectorAll("*");
            const inner_html_template_elements =
              new_inner_html.querySelectorAll("*");
            inner_html_template_elements.forEach((el, i) => {
              const is_equal = inner_html_elements[i].isEqualNode(el);
              if (!is_equal) {
                if (inner_html_elements[i]) {
                  copyAttributes(el, inner_html_elements[i]);
                }
              }
            });
          }
        }

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
            if (has_inner_html) {
              window.bay[this.uniqid].template();
              this.render_innerHTML(this.inner_html_target);
              this.add_events_and_styles(this.inner_html_target, true);
            }

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

            // diff innerHTML
            this.add_events_and_styles(shadowHTML, false);
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
        async add_JS_Blob_event(text) {
          const blob = new Blob(
            [
              `export default () => {"use strict";\n${this.blob_event_prefixes}${text}};`,
            ],
            {
              type: "text/javascript",
            }
          );
          const blobUrl = URL.createObjectURL(blob);
          const code = await import(blobUrl);
          code.default();
          URL.revokeObjectURL(blobUrl);
        }

        /**
         * this will take all the html, scripts and styles make a blob file and add it to the head
         * once the blob file is loaded it will run the script and add the html to the shadow dom
         * the template function will return the html and the styles function will return the styles
         * this is used by the diff function to compare the old and new html and styles with updated data
         */
        async add_JS_BlobFileToHead(text) {
          const blob = new Blob(
            [`export default () => {"use strict";\n${text}};`],
            {
              type: "text/javascript",
            }
          );
          const blobUrl = URL.createObjectURL(blob);
          const code = await import(blobUrl);
          code.default();
          URL.revokeObjectURL(blobUrl);
          if (!this.dsd) {
            this.original_template = window.bay[this.uniqid].template();
            this.shadowRoot.getElementById("bay").innerHTML =
              this.original_template;
          }
          this.render_debouncer();
          if (this.CSP_errors) {
            this.shadowRoot.innerHTML =
              "CSP issue, add blob: to script-src & style-src whitelist.";
            return;
          } else {
            if (this.shadowRoot.querySelector("[bay]")) {
              get_all_bays(this.shadowRoot);
            }
          }
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
            // trigger an event for the bay with uniqid
            window.dispatchEvent(this.local_update_evt);
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

//bay();
export default bay;
