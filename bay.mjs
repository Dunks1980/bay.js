const bay = () => {
  "use strict";
  const $ = (el, selector) => el.querySelectorAll(selector);
  const local_name = "$bay";
  const store_name = "$global";
  const route_name = "$route";
  const element_name = "$el";
  window.bay = {};
  let file_name = "";
  let to_fetch = [];
  let already_fetched = [];
  let blobs_obj = {};

  /**
   * Used to attach shadow roots to templates with the shadowroot attribute
   * @param {HTMLElement} root
   */
  (function attachShadowRoots(root) {
    $(root, "template[shadowroot]").forEach((template) => {
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

  function dispatch_route_event() {
    const evt = new CustomEvent("bay_route_event");
    window.dispatchEvent(evt);
  }

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
   * Creates a proxy and fires the callback when the data changes.
   * @param {object} obj proxy object can be empty or have some default data
   * @param {function} callback function to be called when the data changes
   */
  function make_proxy_object(obj, callback) {
    return new Proxy(obj, {
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
          target[key] = make_proxy_object(prop, callback);
        }
        return target[key];
      },
      set: (target, key, value) => {
        target[key] = escapeHTML(value);
        if (callback) callback();
        return true;
      },
    });
  }

  // make the global data object ---------------------------------
  let dispatch_debounced;
  window.bay.global = make_proxy_object({}, () => {
    if (dispatch_debounced) {
      window.cancelAnimationFrame(dispatch_debounced);
    }
    dispatch_debounced = window.requestAnimationFrame(() => {
      dispatch_global_event();
    });
  });

  // make the route object ---------------------------------
  let route_debounced;
  window.bay.route = make_proxy_object({}, () => {
    if (route_debounced) {
      window.cancelAnimationFrame(route_debounced);
    }
    route_debounced = window.requestAnimationFrame(() => {
      dispatch_route_event();
    });
  });

  // set route proxy ------------------------------
  function update_route() {
    window.bay.route.href = window.location.href;
    window.bay.route.protocol = window.location.protocol;
    window.bay.route.host = window.location.host;
    window.bay.route.hostname = window.location.hostname;
    window.bay.route.port = window.location.port;
    window.bay.route.path = window.location.pathname;
    window.bay.route.search = window.location.search;
    window.bay.route.hash = window.location.hash;
    window.bay.route.params = {};
    let searchParams = new URLSearchParams(window.location.search);
    for (let [key, value] of searchParams) {
      window.bay.route.params[key] = value;
    }
  }
  update_route();
  window.addEventListener("popstate", () => {
    update_route();
  });

  /**
   * find a matching route and return the variables
   * @param {string} url "/users/42/posts/test/test.html"
   * @param {string} pattern "/users/:userId/posts/:postId/*"
   * @returns {object} {id: 42, title: "test"}
   */

  window.bay.router = function (url, pattern) {
    const patternParts = pattern.split("/");
    const urlParts = url.split("/");
    let match = true;
    let params = {};
    if (patternParts.length !== urlParts.length) {
      match = false;
    } else {
      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i][0] === ":") {
          params[patternParts[i].slice(1)] = urlParts[i];
        } else if (patternParts[i] !== "*" && patternParts[i] !== urlParts[i]) {
          match = false;
          break;
        }
      }
    }
    return match ? params : false;
  };

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
  const bay_instance_id = makeid(8);
  // ------------------------------

  /**
   * Finds all custom elements on the page with the attribute "bay"
   * adds them to an array and then fires fetch_component on non dupes.
   * @param {HTMLElement} element root element
   */
  function get_all_bays(element) {
    const bays = [...$(element, "[bay]")];
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
    let styles_string = "";
    let tagname = bay.tagName.toLowerCase();
    let start_split = "export default /*HTML*/`";
    if (template_el.startsWith(start_split)) {
      template_el = template_el.trim();
      template_el = template_el.split(start_split)[1];
      template_el = template_el.substring(0, template_el.length - 2);
      template_el = template_el.replaceAll("\\${", "${").replaceAll("\\`", "`");
    }
    while (template_el.indexOf("<style>") > -1) {
      const styles_text = template_el.split("<style>")[1].split("</style>")[0];
      template_el = template_el.replaceAll(`<style>${styles_text}</style>`, "");
      styles_string += styles_text;
    }
    template_el = template_el.replaceAll(/<!--[\s\S]*?-->/g, "");
    html = doc.parseFromString(template_el, "text/html");
    if (html) {
      if (!customElements.get(tagname)) {
        create_component(
          html,
          tagname,
          getAttributes(bay),
          styles_string,
          false
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
          styles_text,
          true
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
          modify_template(decodeHtml($(bay, "template")[0].innerHTML), bay);
        } else {
          modify_template(decodeHtml(bay.shadowRoot.innerHTML), bay);
        }
      } else if (location.substring(0, 1) === "#") {
        file_name = location;
        const template_el = $(document, location)[0];
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
    const pusher = (attr) => {
      if (
        attr.name !== "bay" &&
        attr.name !== "inner-html" &&
        attr.name !== "fouc" &&
        all_attrs.indexOf(attr.name) === -1
      ) {
        all_attrs.push(attr.name);
      }
    };
    [...bay.attributes].forEach((attr) => pusher(attr));
    [...$(document, bay.tagName.toLocaleLowerCase())].forEach((bay_el) => {
      const this_attrs = [...bay_el.attributes];
      this_attrs.forEach((attr) => pusher(attr));
    });
    [...$(document, "template")].forEach((template) => {
      [...$(template.content, bay.tagName.toLocaleLowerCase())].forEach(
        (bay_el) => {
          const this_attrs = [...bay_el.attributes];
          this_attrs.forEach((attr) => pusher(attr));
        }
      );
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
    const domNodes = [...elem.childNodes];
    const templateNodes = [...template.childNodes];
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
      if (attribute.name === "style") return; // handled by isEqual_fn
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
   * remove element attributes
   * @param {HTMLElement} el
   */
  function removeAttributes(el) {
    while (el.attributes.length > 0) el.removeAttribute(el.attributes[0].name);
  }

  const show_element = /*HTML*/ `
    <div id="show" :style="\${this.style()}"><slot></slot></div>
    <script update>$bay.getElementById('show').ontransitionend = () => this.end();</script>
    <script props>this.slide(this.open);</script>
    <script mounted>this.slide(this.open);</script>
    <script>
      this.opacity = 0;
      this.display = 'none';
      this.slide = (open) => {
        let opacity = 0;
        if (open === 'true') {opacity = 1; this.display = 'block';}
        requestAnimationFrame(() => {this.opacity = opacity;});};
      this.end = () => {if (this.open === 'false') { this.display = 'none';}}
      this.style = () => {return \`display:\${this.display}; opacity:\${this.opacity}; transition: opacity \${this.transition || '0s'};\`;};
    </script>
  `;

  /**
   * Create a custom element from a template.
   * @param {HTMLElement} html html element
   * @param {String} element_tagname custom element tagname
   * @param {Array} attrs array of attributes to be added to the custom element
   * @param {String} styles_text css styles
   */
  function create_component(
    html,
    element_tagname,
    attrs,
    styles_text,
    revoke_blob
  ) {
    let component_tagname = "";
    let component_html = "";
    let script;
    let observedAttributes_from_element;
    let has_globals = false;
    let has_route = false;
    let has_inner_html = false;
    try {
      // css ======================================================
      const fouc_styles =
        "*:not(:defined){opacity:0;max-width:0px;max-height:0px;}*:not(:defined)*{opacity:0;max-width:0px;max-height:0px;}.bay-hide{display:none;}";

      styles_text = fouc_styles + (styles_text || "");

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

      // detect if has route ===================================
      if (
        component_html.innerHTML.indexOf("$route.") > -1 ||
        component_html.innerHTML.indexOf("$route[") > -1 ||
        component_html.innerHTML.indexOf("$bay.update_route") > -1
      ) {
        has_route = true;
      }

      if (component_html.innerHTML.indexOf("</show>") > -1) {
        bay.create(`show-${bay_instance_id}`, show_element, [
          "open",
          "transition",
        ]);
      }

      let array_of_tags = [
        "dsd",
        "noscript",
        "map",
        "for",
        "if",
        "else-if",
        "else",
        "show",
        "switch",
        "case",
        "default",
        "inner-html",
        "route",
        "router",
        "script",
      ];

      let default_params = "element, index, array";
      let script_text = "";

      array_of_tags.forEach((tagname_str) => {
        while ([...$(component_html, tagname_str)].length > 0) {
          const tags = [...$(component_html, tagname_str)];
          tags.forEach((tag_el) => {
            const has_children = $(tag_el, tagname_str)[0];
            if (!has_children) {
              const tag_array = tag_el.getAttribute("array") || [];
              const tag_params =
                tag_el.getAttribute("params") || default_params;
              const tag_join = tag_el.getAttribute("join") || "";
              const tag_duration = tag_el.getAttribute("duration") || "0s";
              const tag_statement = [...tag_el.attributes][0]
                ? [...tag_el.attributes][0].nodeValue
                : "";
              const next_el = tag_el.nextElementSibling
                ? tag_el.nextElementSibling.tagName.toLowerCase()
                : "";
              let close_func = `\` } return '' })() }`;
              const break_prop = tag_el.hasAttribute("break") ? "break;" : "";
              const shared_case = tag_el.innerHTML.length === 0;
              const script_type = tag_el.attributes.length
                ? tag_el.attributes[0].name
                : "";
              const open_tag = `<${tagname_str}>`;
              const close_tag = `</${tagname_str}>`;
              const tag_el_attributes = [...tag_el.attributes];
              removeAttributes(tag_el);
              let outer_html = tag_el.outerHTML;
              switch (tagname_str) {
                case "dsd":
                  tag_el.remove();
                  break;
                case "noscript":
                  component_html.innerHTML = component_html.innerHTML
                    .replaceAll(open_tag, "")
                    .replaceAll(close_tag, "");
                  break;
                case "map":
                  outer_html = outer_html
                    .replace(
                      open_tag,
                      `\${ ${tag_array}.${tagname_str}((${tag_params}) => { return \``
                    )
                    .replace(close_tag, `\`}).join('${tag_join}')}`);
                  tag_el.outerHTML = outer_html;
                  break;
                case "for":
                  const this_for = `bay_${tagname_str}_${makeid(8)}`;
                  if (tag_array.length) {
                    outer_html = outer_html
                      .replace(
                        open_tag,
                        `\${(() => { let ${this_for} = ''; ${tag_array}.forEach((${tag_params}) => { ${this_for} += \``
                      )
                      .replace(close_tag, `\`}); return ${this_for}; })() }`);
                  } else {
                    outer_html = outer_html
                      .replace(
                        open_tag,
                        `\${(() => { let ${this_for} = ''; ${tagname_str} (${tag_statement}) { ${this_for} += \``
                      )
                      .replace(close_tag, `\`}; return ${this_for}; })() }`);
                  }
                  tag_el.outerHTML = outer_html;
                  break;
                case "if":
                  if (next_el === "else-if" || next_el === "else") {
                    close_func = `\` }`;
                  }
                  tag_el.outerHTML = outer_html
                    .replace(
                      open_tag,
                      `\${(() => { ${tagname_str} (${tag_statement}) { return \``
                    )
                    .replace(close_tag, close_func);
                  break;
                case "else-if":
                  if (next_el === "else-if" || next_el === "else") {
                    close_func = `\` }`;
                  }
                  tag_el.outerHTML = outer_html
                    .replace(
                      open_tag,
                      `\ else if (${tag_statement}) { return \``
                    )
                    .replace(close_tag, close_func);
                  break;
                case "else":
                  tag_el.outerHTML = outer_html
                    .replace(open_tag, `\ ${tagname_str} { return \``)
                    .replace(close_tag, close_func);
                  break;
                case "show":
                  if (tag_duration === "0s") {
                    tag_el.outerHTML = outer_html
                      .replace(
                        open_tag,
                        `<div class="\${(${tag_statement}) ? 'bay-show' : 'bay-show bay-hide'}">`
                      )
                      .replace(close_tag, `</div>`);
                  } else {
                    tag_el.outerHTML = outer_html
                      .replace(
                        open_tag,
                        `<show-${bay_instance_id} class="bay-show" open="\${${tag_statement}}" transition="${tag_duration} ease-in-out">`
                      )
                      .replace(close_tag, `</show-${bay_instance_id}>`);
                  }
                  break;
                case "switch":
                  tag_el.outerHTML = outer_html
                    .replace(
                      open_tag,
                      `\${(() => { ${tagname_str} (${tag_statement}) { `
                    )
                    .replace(close_tag, ` }; return '' })() }`);
                  break;
                case "case":
                  if (shared_case) {
                    tag_el.outerHTML = outer_html
                      .replace(open_tag, `${tagname_str} ${tag_statement}:`)
                      .replace(close_tag, ` ` + break_prop);
                  } else {
                    tag_el.outerHTML = outer_html
                      .replace(
                        open_tag,
                        `${tagname_str} ${tag_statement}: return \``
                      )
                      .replace(close_tag, `\`; ` + break_prop);
                  }
                  break;
                case "default":
                  tag_el.outerHTML = outer_html
                    .replace(open_tag, `${tagname_str}: return \``)
                    .replace(close_tag, `\`;`);
                  break;
                case "inner-html":
                  has_inner_html = true;
                  tag_el.outerHTML = outer_html
                    .replace(open_tag, "${ (() => { $bay_inner_html += `")
                    .replace(close_tag, "`; return ''} )()}");
                  tag_el.remove();
                  break;
                case "route":
                  let attrs_str = "";
                  tag_el_attributes.forEach((attr) => {
                    attrs_str += ` ${attr.name}="${attr.value}"`;
                  });
                  tag_el.outerHTML = outer_html
                    .replace(
                      open_tag,
                      `<a bay-route :click="e.preventDefault();history.pushState({},'',e.target.getAttribute('href'));$bay.update_route();"${attrs_str}>`
                    )
                    .replace(close_tag, `</a>`);
                  break;
                case "router":
                  tag_el.outerHTML = outer_html
                    .replace(
                      open_tag,
                      `\${(() => { let $path = window.bay.router(window.bay.route.path,'${tag_statement}'); if ($path) { return \``
                    )
                    .replace(close_tag, close_func);
                  break;
                case "script":
                  // ------------------ SCRIPT TAGS ------------------
                  switch (script_type) {
                    case "update":
                      outer_html = outer_html
                        .replace(
                          open_tag,
                          "${/*update*/ (() => {setTimeout(() => {"
                        )
                        .replace(close_tag, "}, 0); return ``})()}");
                      break;
                    case "props":
                      outer_html = outer_html
                        .replace(
                          open_tag,
                          "${ /*props updates*/ (() => {$props = () => {"
                        )
                        .replace(close_tag, "};return ``})()}");
                      break;
                    case "render":
                      outer_html = outer_html
                        .replace(open_tag, "${ /*render*/ (() => {")
                        .replace(close_tag, " return ``})()}");
                      break;
                    case "slotchange":
                      outer_html = outer_html
                        .replace(
                          open_tag,
                          "${ /*slotchange updates*/ (() => {$slotchange = (e) => { $details = e.detail;\n"
                        )
                        .replace(close_tag, "};return ``})()}");
                      break;
                    case "mounted":
                      script_text += `$bay['$mounted'] = () => {${tag_el.innerText}};`;
                      tag_el.remove();
                      break;
                    default:
                      script_text += $(component_html, tagname_str)[0]
                        .innerText;
                      tag_el.remove();
                      break;
                  }
                  if (tag_el && tag_el.parentNode) {
                    tag_el.outerHTML = outer_html;
                    tag_el.remove();
                  }
                  break;
              }
            }
          });
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
          this.original_template = `${component_html.innerHTML}`;
          this.uniqid = makeid(8);
          this.CSP_errors = false;
          this.dsd = false;
          this.debouncer = false;
          this.blob_prefixes = "";
          this.blob_event_prefixes = "";

          const inner_html_target = this.getAttribute("inner-html");
          if (inner_html_target) {
            if ($(document, inner_html_target)[0]) {
              this.inner_html_target = $(document, inner_html_target)[0];
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
            let template = document.createElement("template");
            template.innerHTML = /*HTML*/ `<div id="bay"></div>`;
            this.shadowRoot.appendChild(template.content.cloneNode(true));
          }

          // local proxy setup =============================================
          this.shadowRoot.proxy = make_proxy_object({}, () => {
            this.render_debouncer();
          });
          this.shadowRootHTML = $(this.shadowRoot, "#bay")[0];

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

          // for getting the component's root element ======================
          this.shadowRoot.uniqid = this.uniqid;
          let rootNode = this.getRootNode();
          let parent_var = ``;
          let parent_event_var = ``;
          let parent_uniqid = ``;
          if (rootNode.host) {
            parent_var = `const $parent = window.bay[parent_uniqid]['proxy'];\n`;
            parent_event_var = `const $parent = window.bay['${rootNode.host.uniqid}']['proxy'];\n`;
            parent_uniqid = rootNode.host.uniqid;
          }

          const local_var = `const ${local_name} = window.bay[bay_uniqid];\n`;
          const local_evevt_var = `const ${local_name} = window.bay['${this.uniqid}'];\n`;
          const global_var = `const ${store_name} = window.bay.global;\n`;
          const route_var = `const ${route_name} = window.bay.route;\n`;
          const element_var = `const ${element_name} = ${local_name}['${element_name}'];\n`;

          // add update function ===========================================
          this.local_update_evt = new CustomEvent(
            `bay_local_update_event_${this.uniqid}`
          );
          let update_func = ``;
          if (this.original_template.indexOf(`/*props updates*/`) > -1) {
            update_func = `let $props;\nwindow.addEventListener(\`bay_local_update_event_\${bay_uniqid}\`, () => $props());\n`;
          }

          // add slotchange function =======================================
          let slotchange_func = ``;
          if (this.original_template.indexOf(`/*slotchange updates*/`) > -1) {
            update_func = `let $slotchange = () => {};\nlet $details = {'element': '', 'changed': ''};\nwindow.addEventListener(\`bay_slotchange_event_\${bay_uniqid}\`, (e) => $slotchange(e));\n`;
          }

          // add decode & encode functions =================================
          window.bay.decode = decodeHtml;
          const decode_var = `$bay.decode = window.bay.decode;\n`;

          window.bay.encode = escapeHTML;
          const encode_var = `$bay.encode = window.bay.encode;\n`;

          // add update route function =====================================
          window.bay.update_route = update_route;
          let route_update_var = ``;
          if (has_route) {
            route_update_var = `$bay.update_route = window.bay.update_route;\n`;
          }

          // add slotchange event ==========================================
          window.bay[this.uniqid].addEventListener("slotchange", (e) => {
            this.local_slotchange_evt = new CustomEvent(
              `bay_slotchange_event_${this.uniqid}`,
              { detail: { element: e.target, changed: "slotchange" } }
            );
            window.dispatchEvent(this.local_slotchange_evt);
          });
          let bay_slots = $(this, "*");
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

          this.blob_prefixes = `${local_var}${global_var}${route_var}${element_var}${parent_var}${inner_html_var}${encode_var}${decode_var}${update_func}${slotchange_func}${route_update_var}`;

          this.blob_event_prefixes = `${local_evevt_var}${global_var}${route_var}${element_var}${parent_event_var}${encode_var}${decode_var}${route_update_var}`;

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
            `${proxy_script}\n${local_name}.template = () => {${inner_html_reset}return \`${proxy_html}\`;};\n${local_name}.styles = () => { return \`${proxy_css}\`;};${inner_html_fn}`,
            parent_uniqid
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

        add_events_and_styles(elements) {
          if (!elements) return;
          let this_newEvents = ``;
          elements.forEach((el, i) => {
            const attrs = el.attributes;
            [...attrs].forEach((attr) => {
              let event = attr.name.substring(0, 1) === ":";
              if (event) {
                if (attr.name.indexOf(":style") > -1) {
                  el.style = attr.value;
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

        isEqual_fn(template_els, current_els) {
          template_els.forEach((el, i) => {
            const is_equal = current_els[i].isEqualNode(el);
            if (!is_equal && current_els[i]) {
              copyAttributes(el, current_els[i]);
            }
            // cleanup old styles
            if (!el.hasAttribute(":style") && !el.hasAttribute("style")) {
              current_els[i].removeAttribute("style");
            }
          });
        }

        render_innerHTML(html_target) {
          if (!html_target) return;
          if (typeof window.bay[this.uniqid].inner_html !== "function") return;
          window.bay[this.uniqid].template();
          const new_inner_html = stringToHTML(
            window.bay[this.uniqid].inner_html()
          );
          dom_diff(new_inner_html, html_target);
          const inner_html_elements = [...$(html_target, "*")];
          const inner_html_template_elements = [...$(new_inner_html, "*")];
          this.isEqual_fn(inner_html_template_elements, inner_html_elements);
        }

        render_shadowDOM() {
          const templateHTML = stringToHTML(window.bay[this.uniqid].template());
          dom_diff(templateHTML, this.shadowRootHTML);
          const all_template_elements = [...$(templateHTML, "*")];
          const all_shadow_elements = [...$(this.shadowRootHTML, "*")];
          this.isEqual_fn(all_template_elements, all_shadow_elements);
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
          if (!this.original_template || !this.shadowRootHTML.innerHTML) {
            return;
          }
          if (typeof window.bay[this.uniqid].template !== "function") {
            return;
          }
          try {
            // Diff the DOM and template
            if (has_inner_html) {
              this.render_innerHTML(this.inner_html_target);
            }
            this.render_shadowDOM();

            // Events and Styles
            if (has_inner_html) {
              this.add_events_and_styles([
                ...$(this.inner_html_target, "*"),
                ...$(this.shadowRootHTML, "*"),
              ]);
            } else {
              this.add_events_and_styles([...$(this.shadowRootHTML, "*")]);
            }

            this.set_styles();

            if (this.mounted === false && window.bay[this.uniqid]["$mounted"]) {
              this.mounted = true;
              setTimeout(() => {
                window.bay[this.uniqid]["$mounted"]();
              }, 14);
            }

            if ($(this.shadowRoot, "[bay]")[0]) {
              get_all_bays(this.shadowRoot);
            }

            if (this.hasAttribute("fouc")) {
              this.removeAttribute("fouc");
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
        async add_JS_BlobFileToHead(text, parent_uniqid) {
          if (!blobs_obj[element_tagname]) {
            const blob = new Blob(
              [
                `export default (bay_uniqid, parent_uniqid) => {"use strict";\n${text}};`,
              ],
              { type: "text/javascript" }
            );
            const blobUrl = URL.createObjectURL(blob);
            blobs_obj[element_tagname] = blobUrl;
            await import(blobUrl).then((code) => {
              code.default(this.uniqid, parent_uniqid);
              this.after_blob_loaded();
              if (revoke_blob) {
                URL.revokeObjectURL(blobUrl);
              }
            });
          } else {
            await import(blobs_obj[element_tagname]).then((code) => {
              code.default(this.uniqid, parent_uniqid);
              this.after_blob_loaded();
            });
          }
        }

        after_blob_loaded() {
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
            if ($(this.shadowRoot, "[bay]")[0]) {
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
            if (has_route) {
              window.addEventListener("bay_route_event", (e) => {
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

  window.addEventListener("load", () => {
    get_all_bays(document);
  });

  bay.refresh = () => {
    get_all_bays(document);
  };

  bay.create = create_template_fn;
};

//bay();
export default bay;
