var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const bay = () => {
    "use strict";
    if (window.bay) {
        return;
    }
    else {
        window.bay = {};
    }
    const $ = (el, selector) => el.querySelectorAll(selector);
    const local_name = "$bay";
    const store_name = "$global";
    const route_name = "$route";
    const element_name = "$el";
    const data_attr = `data-bay-`;
    let file_name = "";
    let to_fetch = [];
    let already_fetched = [];
    let blobs = new Map();
    /**
     * Used to attach shadow roots to templates with the shadowroot or shadowrootmode attribute
     */
    (function attachShadowRoots(root) {
        $(root, "template[shadowrootmode], template[shadowroot]").forEach((template) => {
            const mode = template.getAttribute("shadowrootmode") ||
                template.getAttribute("shadowroot");
            const shadowRoot = template.parentNode.attachShadow({ mode });
            shadowRoot.appendChild(template.content);
            template.remove();
            attachShadowRoots(shadowRoot);
        });
    })(document);
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
    function emit(name, data) {
        const detail = { detail: { name, data } };
        window.dispatchEvent(new CustomEvent("bay_emit", detail));
        window.dispatchEvent(new CustomEvent(name, detail));
    }
    window.bay.emit = emit;
    function receive($bay, $el, name, data) {
        const els = [
            ...$($bay, `[data-bay-${name}]`),
            ...$($el, `[data-bay-${name}]`),
            ...$(document, `[data-bay-${name}]`),
        ];
        els.forEach((el) => {
            el.dispatchEvent(new CustomEvent(name, { detail: { name, data } }));
        });
    }
    window.bay.receive = receive;
    function make_map_proxy(map, callback) {
        return new Proxy(map, {
            get(target, key) {
                if (key === "set") {
                    return function (k, v) {
                        target.set(k, escapeHTML(v));
                        if (callback)
                            callback();
                        return target;
                    };
                }
                else if (["get", "has", "delete", "clear"].includes(key)) {
                    return function (...args) {
                        return target[key].apply(target, args);
                    };
                }
                else {
                    return target[key];
                }
            },
        });
    }
    function make_weakmap_proxy(map, callback) {
        return new Proxy(map, {
            get(target, key) {
                if (key === "set") {
                    return function (k, v) {
                        target.set(k, escapeHTML(v));
                        if (callback)
                            callback();
                        return target;
                    };
                }
                else if (["get", "has", "delete"].includes(key)) {
                    return function (...args) {
                        return target[key].apply(target, args);
                    };
                }
                else {
                    return target[key];
                }
            },
        });
    }
    function make_set_proxy(set, callback) {
        return new Proxy(set, {
            get(target, key) {
                if (key === "add") {
                    return function (v) {
                        target.add(escapeHTML(v));
                        if (callback)
                            callback();
                        return target;
                    };
                }
                else if (["has", "delete", "clear"].includes(key)) {
                    return function (...args) {
                        return target[key].apply(target, args);
                    };
                }
                else {
                    return target[key];
                }
            },
        });
    }
    function make_weakset_proxy(set, callback) {
        return new Proxy(set, {
            get(target, key) {
                if (key === "add") {
                    return function (v) {
                        target.add(escapeHTML(v));
                        if (callback)
                            callback();
                        return target;
                    };
                }
                else if (["has", "delete"].includes(key)) {
                    return function (...args) {
                        return target[key].apply(target, args);
                    };
                }
                else {
                    return target[key];
                }
            },
        });
    }
    function make_proxy_object(obj, callback) {
        return new Proxy(obj, {
            get(target, key) {
                if (key === "isProxy") {
                    return true;
                }
                const prop = target[key];
                if (typeof prop === "undefined") {
                    return "";
                }
                if (prop === null) {
                    return;
                }
                if (!prop.isProxy && typeof prop === "object") {
                    if (prop instanceof Map) {
                        target[key] = make_map_proxy(prop, callback);
                    }
                    else if (prop instanceof WeakMap) {
                        target[key] = make_weakmap_proxy(prop, callback);
                    }
                    else if (prop instanceof Set) {
                        target[key] = make_set_proxy(prop, callback);
                    }
                    else if (prop instanceof WeakSet) {
                        target[key] = make_weakset_proxy(prop, callback);
                    }
                    else {
                        target[key] = make_proxy_object(prop, callback);
                    }
                }
                return target[key];
            },
            set: (target, key, value) => {
                target[key] = escapeHTML(value);
                if (callback)
                    callback();
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
            window.dispatchEvent(new CustomEvent("bay_global_event"));
        });
    });
    // make the route object ---------------------------------
    let route_debounced;
    window.bay.route = make_proxy_object({}, () => {
        if (route_debounced) {
            window.cancelAnimationFrame(route_debounced);
        }
        route_debounced = window.requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent("bay_route_event"));
        });
    });
    // set route proxy ------------------------------
    function update_route() {
        Object.entries(window.location).forEach((loc) => {
            window.bay.route[`${loc[0]}`] = loc[1];
        });
        window.bay.route.path = window.location.pathname;
        window.bay.route.params = {};
        const searchParams = new URLSearchParams(window.location.search);
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
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i][0] === ":") {
                params[patternParts[i].slice(1)] = urlParts[i];
            }
            else if (patternParts[i] !== "*" && patternParts[i] !== urlParts[i]) {
                match = false;
                break;
            }
        }
        return match ? params : false;
    };
    /**
     * Generates a random string to be used as a unique ID.
     * @param {number} length length of the string to be generated
     */
    function makeid(length) {
        const uuidv4 = () => {
            return ([1e7].toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^
                (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
        };
        return uuidv4().replaceAll("-", "").substring(0, length);
    }
    const bay_instance_id = makeid(8);
    // ------------------------------
    /**
     * Finds all custom elements on the page with the attribute "bay"
     * adds them to an array and then fires fetch_component on non dupes.
     * @param {HTMLElement} element root element
     */
    function get_all_bays(element) {
        [...document.querySelectorAll("[bay-hydrate]")].forEach((el, i) => {
            el.id = "bay-hydrate-" + i;
            let html_content = el.querySelector("template").innerHTML;
            let component = document.createElement("bay-hydrate-" + i);
            component.setAttribute("inner-html", "#bay-hydrate-" + i);
            document.body.appendChild(component);
            window.bay.create("bay-hydrate-" + i, "<inner-html>" + html_content + "</inner-html>");
        });
        [...$(element, "[bay]")].forEach((el, i) => {
            if (el.getAttribute("bay") === "dsd") {
                el.setAttribute("bay", `dsd-${i}`);
            }
            if (to_fetch.indexOf(el.getAttribute("bay") || "") === -1) {
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
        const tagname = bay.tagName.toLowerCase();
        const start_split = "export default /*HTML*/`";
        let html;
        let styles_string = "";
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
        //console.log(html);
        function continue_to_create() {
            if (html && [...html.querySelectorAll("include")].length === 0) {
                if (!customElements.get(tagname)) {
                    create_component(html, tagname, getAttributes(bay), styles_string, false);
                }
            }
        }
        const incudes = [...html.querySelectorAll("include")];
        incudes.forEach((include) => {
            const src = include.attributes[0];
            if (src && src.value) {
                fetch(src.value)
                    .then((res) => {
                    if (!res.ok) {
                        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
                    }
                    return res.text();
                })
                    .then((text) => {
                    while (text.indexOf("<style>") > -1) {
                        const styles_text = text.split("<style>")[1].split("</style>")[0];
                        text = text.replaceAll(`<style>${styles_text}</style>`, "");
                        styles_string += styles_text;
                    }
                    text = text.replaceAll(/<!--[\s\S]*?-->/g, "");
                    include.outerHTML = text;
                    continue_to_create();
                })
                    .catch((error) => {
                    console.error('Error fetching:', error);
                });
            }
        });
        continue_to_create();
    }
    // ------------------------------
    /**
     * Creates a custom element from a template invoked via function.
     * @param {String} element_tagname custom element tagname
     * @param {String} template_string template string
     * @param {Array} attributes_array array of attributes to be added to the custom element
     */
    function create_template_fn(element_tagname, template_string, attributes_array) {
        const doc = new DOMParser();
        const passed_attributes = attributes_array || [];
        let styles_text = "";
        if (template_string.indexOf("<style>") > -1) {
            styles_text = template_string.split("<style>")[1].split("</style>")[0];
        }
        template_string = template_string
            .replaceAll(/<!--[\s\S]*?-->/g, "")
            .replaceAll(`<style>${styles_text}</style>`, "");
        let html = doc.parseFromString(template_string, "text/html");
        if (html) {
            if (!customElements.get(element_tagname.toLowerCase())) {
                create_component(html, element_tagname.toLowerCase(), passed_attributes, styles_text, true);
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
            const location = bay.getAttribute("bay") || "";
            if (location.substring(0, 4) === "dsd-") {
                file_name = location;
                if (!bay.shadowRoot) {
                    modify_template(decodeHtml($(bay, "template")[0].innerHTML), bay);
                }
                else {
                    modify_template(decodeHtml(bay.shadowRoot.innerHTML), bay);
                }
            }
            else if (location.substring(0, 1) === "#") {
                file_name = location;
                const template_el = $(document, location)[0];
                if (!template_el) {
                    console.error(`Bay cannot find "${location}" selector.`);
                    return;
                }
                modify_template(template_el.innerHTML, bay);
            }
            else {
                fetch(location)
                    .then((res) => res.text())
                    .then((html) => {
                    modify_template(html, bay);
                })
                    .catch((error) => {
                    console.error("Error:", error);
                });
            }
        }
        catch (error) {
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
            if (attr.name !== "bay" &&
                attr.name !== "inner-html" &&
                attr.name !== "fouc" &&
                all_attrs.indexOf(attr.name) === -1) {
                all_attrs.push(attr.name);
            }
        };
        [...bay.attributes].forEach((attr) => pusher(attr));
        [...$(document, bay.tagName.toLocaleLowerCase())].forEach((bay_el) => {
            const this_attrs = [...bay_el.attributes];
            this_attrs.forEach((attr) => pusher(attr));
        });
        [...$(document, "template")].forEach((template) => {
            [...$(template.content, bay.tagName.toLocaleLowerCase())].forEach((bay_el) => {
                const this_attrs = [...bay_el.attributes];
                this_attrs.forEach((attr) => pusher(attr));
            });
        });
        return all_attrs;
    }
    // ------------------------------
    function isEqual_fn(template_els, current_els) {
        template_els.forEach((el, i) => {
            const is_equal = current_els[i].isEqualNode(el);
            if (!is_equal && current_els[i]) {
                copyAttributes(el, current_els[i]);
            }
            // cleanup old styles
            if (!el.hasAttribute(`${data_attr}style`) && !el.hasAttribute("style")) {
                const save_width = current_els[i].style.width;
                const save_height = current_els[i].style.height;
                current_els[i].removeAttribute("style");
                save_width ? (current_els[i].style.width = save_width) : null;
                save_height ? (current_els[i].style.height = save_height) : null;
            }
        });
    }
    function render_innerHTML(uuid, html_target) {
        if (!html_target)
            return;
        if (typeof window.bay[uuid].inner_html !== "function")
            return;
        window.bay[uuid].template();
        const new_inner_html = stringToHTML(window.bay[uuid].inner_html());
        dom_diff(new_inner_html, html_target);
        isEqual_fn([...$(new_inner_html, "*")], [...$(html_target, "*")]);
    }
    function render_shadowDOM(uuid, shadow_html) {
        const templateHTML = stringToHTML(window.bay[uuid].template());
        dom_diff(templateHTML, shadow_html);
        isEqual_fn([...$(templateHTML, "*")], [...$(shadow_html, "*")]);
    }
    function add_events(this_ref, elements) {
        if (!elements)
            return;
        this_ref.newEvents = ``;
        elements.forEach((el, i) => {
            // elements are the elements that have been added to the DOM
            [...el.attributes].forEach((attr) => apply_events(this_ref, attr, el, i));
        });
        if (this_ref.newEvents && this_ref.oldEvents !== this_ref.newEvents) {
            this_ref.oldEvents = this_ref.newEvents;
            addBlob_event(this_ref, this_ref.newEvents);
        }
    }
    // constructed styles
    function set_styles(this_ref) {
        const new_styles = window.bay[this_ref.uniqid][`styles`]();
        if (this_ref.oldStyles !== new_styles) {
            this_ref.oldStyles = new_styles;
            if (this_ref.hasAdopted) {
                this_ref.sheet.replaceSync(new_styles);
            }
            else {
                // safari
                const blob = new Blob([new_styles], {
                    type: "text/css",
                });
                const blobUrl = URL.createObjectURL(blob);
                this_ref.styleLinkUpdate.href = blobUrl;
                URL.revokeObjectURL(blobUrl);
            }
        }
    }
    function apply_events(this_ref, attr, el, i) {
        let attr_name = attr.name;
        if (attr_name.indexOf(data_attr) > -1) {
            let custom_event = attr_name.indexOf(`-custom-`) > -1;
            if (custom_event) {
                attr_name = attr_name.replace(`custom-`, "");
            }
            if (attr_name.indexOf(`${data_attr}style`) > -1) {
                if (el.style !== attr.value) {
                    el.style = attr.value;
                }
            }
            else {
                const attr_data = attr.value.replaceAll("window.bay", `${local_name}`);
                if (this_ref.newEvents.indexOf(`${local_name}.events=new Map();\n`) === -1) {
                    this_ref.newEvents += `${local_name}.events=new Map();\n`;
                }
                this_ref.newEvents += `${local_name}.events.set('${attr_name}-${i}',function(e){${attr_data}});\n`;
                const handle = (e) => {
                    if (window.bay[this_ref.uniqid].events)
                        window.bay[this_ref.uniqid].events.get(`${attr_name}-${i}`)(e);
                };
                const handler_id = `${this_ref.uniqid}${i}${attr_name}`;
                const handler_event = attr_name.split(data_attr)[1];
                if (this_ref.eventHandlers.has(handler_id)) {
                    el.removeEventListener(handler_event, this_ref.eventHandlers.get(handler_id));
                    this_ref.eventHandlers.delete(handler_id);
                }
                this_ref.eventHandlers.set(handler_id, handle);
                el.addEventListener(handler_event, this_ref.eventHandlers.get(handler_id));
            }
        }
    }
    function render_debouncer(this_ref) {
        if (this_ref.debouncer) {
            window.cancelAnimationFrame(this_ref.debouncer);
        }
        this_ref.debouncer = window.requestAnimationFrame(() => {
            this_ref.render();
        });
    }
    /**
     * this will create a blob file with all the events on the html (:click)
     * and add, is used to add the js in the attribute to memory
     */
    function addBlob_event(this_ref, text) {
        return __awaiter(this, void 0, void 0, function* () {
            const blobUrl = URL.createObjectURL(new Blob([
                `export default ()=>{"use strict";\n${this_ref.evt_prefixes.join("")}${text}};`,
            ], {
                type: "text/javascript",
            }));
            const code = yield import(blobUrl);
            code.default();
            URL.revokeObjectURL(blobUrl);
        });
    }
    /**
     * this will take all the html, scripts and styles make a blob file and add it to the head
     * once the blob file is loaded it will run the script and add the html to the shadow dom
     * the template function will return the html and the styles function will return the styles
     * this is used by the diff function to compare the old and new html and styles with updated data
     */
    function addBlob(this_ref, revoke_blob, element_tagname, text, parent_uniqid, import_script) {
        return __awaiter(this, void 0, void 0, function* () {
            if (blobs.has(element_tagname)) {
                yield import(blobs.get(element_tagname)).then((code) => {
                    code.default(this_ref.uniqid, parent_uniqid);
                    after_blob_loaded(this_ref);
                });
            }
            else {
                const blobUrl = URL.createObjectURL(new Blob([
                    `${import_script}export default (bay_uniqid,parent_uniqid)=>{"use strict";\n${text}};`,
                ], { type: "text/javascript" }));
                blobs.set(element_tagname, blobUrl);
                yield import(blobUrl).then((code) => {
                    code.default(this_ref.uniqid, parent_uniqid);
                    after_blob_loaded(this_ref);
                    if (revoke_blob) {
                        URL.revokeObjectURL(blobUrl);
                    }
                });
            }
        });
    }
    function after_blob_loaded(this_ref) {
        if (!this_ref.dsd) {
            this_ref.tmp = window.bay[this_ref.uniqid].template();
            this_ref.shadowDom.getElementById("bay").innerHTML = this_ref.tmp;
        }
        render_debouncer(this_ref);
        if (this_ref.CSP) {
            this_ref.shadowDom.innerHTML =
                "CSP issue, add blob: to script-src & style-src whitelist.";
            return;
        }
        else {
            if ($(this_ref.shadowDom, "[bay]")[0]) {
                get_all_bays(this_ref.shadowDom);
            }
        }
    }
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
        if (node.nodeType === 3)
            return "text";
        if (node.nodeType === 8)
            return "comment";
        return node.tagName.toLowerCase();
    }
    /**
     * return the text content of the node
     * @param {HTMLElement} node
     */
    function getNodeContent(node) {
        if (node.childNodes && node.childNodes.length > 0)
            return null;
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
                domNodes[domNodes.length - count].parentNode.removeChild(domNodes[domNodes.length - count]);
            }
        }
        templateNodes.forEach((template_node, index) => {
            if (!domNodes[index]) {
                elem.appendChild(template_node.cloneNode(true));
                return;
            }
            if (getNodeType(template_node) !== getNodeType(domNodes[index])) {
                try {
                    domNodes[index].parentNode.replaceChild(template_node.cloneNode(true), domNodes[index]);
                }
                catch (error) { }
                return;
            }
            const templateContent = getNodeContent(template_node);
            if (templateContent &&
                templateContent !== getNodeContent(domNodes[index])) {
                domNodes[index].textContent = templateContent;
            }
            if (domNodes[index].childNodes.length > 0 &&
                template_node.childNodes.length < 1) {
                domNodes[index].innerHTML = "";
                return;
            }
            if (domNodes[index].childNodes.length < 1 &&
                template_node.childNodes.length > 0) {
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
        if (typeof element[attribute] !== "undefined" &&
            typeof element[attribute] !== "object") {
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
            if (attribute.name === "style")
                return; // handled by isEqual_fn
            if (!template.hasAttribute(attribute.name)) {
                shadow.removeAttribute(attribute.nodeName);
                if (canSetAttribute(shadow, attribute.nodeName)) {
                    delete shadow[attribute.nodeName];
                }
            }
        });
        [...template.attributes].forEach((attribute) => {
            if (!shadow.hasAttribute(attribute.nodeName) ||
                shadow.getAttribute(attribute.nodeName) !== attribute.value) {
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
        while (el.attributes.length > 0)
            el.removeAttribute(el.attributes[0].name);
    }
    const show_element = /*HTML*/ `<div id="show" :style="\${this.style()}"><slot></slot></div><script update>$bay.getElementById('show').ontransitionend=()=>this.end();</script><script props>this.slide(this.open);</script><script mounted>this.slide(this.open);</script><script>this.opacity=0;this.display='none';this.slide=(open)=>{let opacity=0;if(open==='true'){opacity=1;this.display='block';};requestAnimationFrame(()=>{this.opacity=opacity;});};this.end=()=>{if(this.open==='false'){this.display='none';}};this.style=()=>{return \`display:\${this.display};opacity:\${this.opacity};transition:opacity \${this.transition || '0s'};\`;};</script>`;
    /**
     * Create a custom element from a template.
     * @param {HTMLElement} html html element
     * @param {String} element_tagname custom element tagname
     * @param {Array} attrs array of attributes to be added to the custom element
     * @param {String} styles_text css styles
     */
    function create_component(html, element_tagname, attrs, styles_text, revoke_blob) {
        let tag = "";
        let c_html = null;
        let script = "";
        let import_script = "";
        let observedAttributes_from_element = [];
        let has_globals = false;
        let has_route = false;
        let has_inner_html = false;
        let has_select_bind = false;
        let has_on = false;
        try {
            // css ======================================================
            const fouc_styles = "*:not(:defined){opacity:0;max-width:0px;max-height:0px}" +
                "*:not(:defined)*{opacity:0;max-width:0px;max-height:0px}" +
                ".bay-hide{display:none}";
            styles_text = fouc_styles + (styles_text || "");
            // html ====================================================
            c_html = html.body;
            tag = element_tagname;
            // Add update element ======================================
            const update_el = document.createElement(`${element_tagname}-update`);
            c_html.appendChild(update_el);
            // detect if has globals ===================================
            if (c_html.innerHTML.indexOf("$global.") > -1 ||
                c_html.innerHTML.indexOf("$global[") > -1) {
                has_globals = true;
            }
            // detect if has route ===================================
            if (c_html.innerHTML.indexOf("$route.") > -1 ||
                c_html.innerHTML.indexOf("$route[") > -1 ||
                c_html.innerHTML.indexOf("</router>") > -1 ||
                c_html.innerHTML.indexOf("</route>") > -1 ||
                c_html.innerHTML.indexOf("$bay.update_route") > -1) {
                has_route = true;
            }
            if (c_html.innerHTML.indexOf("</route>") > -1) {
                styles_text =
                    (styles_text || "") + "[bay-route]>*{pointer-events:none}";
            }
            // detect if has on ===================================
            if (c_html.innerHTML.indexOf("$bay.on(") > -1) {
                has_on = true;
            }
            // detect if has show ===================================
            if (c_html.innerHTML.indexOf("</show>") > -1) {
                bay.create(`show-${bay_instance_id}`, show_element, [
                    "open",
                    "transition",
                ]);
            }
            const default_params = "element, index, array";
            let script_text = "";
            const tag_changer = (tag_el, tagname_str) => {
                const has_children = $(tag_el, tagname_str)[0];
                if (!has_children) {
                    const tag_array = tag_el.getAttribute("array") || [];
                    const tag_params = tag_el.getAttribute("params") || default_params;
                    const tag_join = tag_el.getAttribute("join") || "";
                    const tag_duration = tag_el.getAttribute("duration") || false;
                    const tag_statement = [...tag_el.attributes][0]
                        ? [...tag_el.attributes][0].nodeValue
                        : "";
                    const next_el = tag_el.nextElementSibling
                        ? tag_el.nextElementSibling.tagName.toLowerCase()
                        : "";
                    let close_func = `\`}return ''})()}`;
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
                    const rep = (open, close) => {
                        tag_el.outerHTML = outer_html
                            .replace(open_tag, open)
                            .replace(close_tag, close);
                    };
                    switch (tagname_str) {
                        case "dsd":
                            tag_el.remove();
                            break;
                        case "noscript":
                            c_html.innerHTML = c_html.innerHTML
                                .replaceAll(open_tag, "")
                                .replaceAll(close_tag, "");
                            break;
                        case "map":
                            rep(`\${ ${tag_array}.${tagname_str}((${tag_params})=>{return \``, `\`}).join('${tag_join}')}`);
                            break;
                        case "for":
                            const this_for = `bay_${tagname_str}_${makeid(8)}`;
                            if (tag_array.length) {
                                rep(`\${(()=>{let ${this_for}='';${tag_array}.forEach((${tag_params})=>{${this_for}+=\``, `\`});return ${this_for};})()}`);
                            }
                            else {
                                rep(`\${(()=>{let ${this_for}=''; ${tagname_str} (${tag_statement}) { ${this_for} += \``, `\`};return ${this_for};})() }`);
                            }
                            break;
                        case "if":
                            if (next_el === "else-if" || next_el === "else") {
                                close_func = `\`}`;
                            }
                            rep(`\${(()=>{ ${tagname_str} (${tag_statement}) {return \``, close_func);
                            break;
                        case "else-if":
                            if (next_el === "else-if" || next_el === "else") {
                                close_func = `\`}`;
                            }
                            rep(`\ else if (${tag_statement}) {return \``, close_func);
                            break;
                        case "else":
                            rep(`\ ${tagname_str} {return \``, close_func);
                            break;
                        case "show":
                            if (!tag_duration) {
                                rep(`<div class="\${(${tag_statement})?'bay-show':'bay-show bay-hide'}">`, `</div>`);
                            }
                            else {
                                rep(`<show-${bay_instance_id} class="bay-show" open="\${${tag_statement}}" transition="${tag_duration} ease-in-out">`, `</show-${bay_instance_id}>`);
                            }
                            break;
                        case "switch":
                            rep(`\${(()=>{let bay_switch=''; ${tagname_str} (${tag_statement}) { `, ` };return bay_switch;})() }`);
                            break;
                        case "case":
                            if (shared_case) {
                                rep(`${tagname_str} ${tag_statement}:`, ` ` + break_prop);
                            }
                            else {
                                rep(`${tagname_str} ${tag_statement}: bay_switch += \``, `\`; ` + break_prop);
                            }
                            break;
                        case "default":
                            rep(`${tagname_str}: bay_switch += \``, `\`;`);
                            break;
                        case "inner-html":
                            has_inner_html = true;
                            rep("${ (()=>{$bay_inner_html+=`", "`;return ''})()}");
                            tag_el.remove();
                            break;
                        case "route":
                            let attrs_str = "";
                            tag_el_attributes.forEach((attr) => {
                                attrs_str += ` ${attr.name}="${attr.value}"`;
                            });
                            rep(`<a bay-route :click="e.preventDefault();history.pushState({},'',e.target.getAttribute('href'));window.bay.update_route();"${attrs_str}>`, `</a>`);
                            break;
                        case "router":
                            rep(`\${(()=>{let $path=window.bay.router(window.bay.route.path,'${tag_statement}');if($path){return \``, close_func);
                            break;
                        case "script":
                            // ------------------ SCRIPT TAGS ------------------
                            switch (script_type) {
                                case "imports":
                                    import_script += tag_el.innerText.trim() + "\n";
                                    tag_el.remove();
                                    break;
                                case "update":
                                    rep("${/*update*/(()=>{setTimeout(()=>{", "}, 0);return ``})()}");
                                    break;
                                case "props":
                                    rep("${/*props updates*/(()=>{$props=()=>{", "};return ``})()}");
                                    break;
                                case "render":
                                    rep("${/*render*/(()=>{", "})()}");
                                    break;
                                case "slotchange":
                                    rep("${/*slotchange updates*/(()=>{$slotchange=(e)=>{$details=e.detail;\n", "};return ``})()}");
                                    break;
                                case "mounted":
                                    script_text += `$bay['$mounted']=()=>{${tag_el.innerText}};`;
                                    tag_el.remove();
                                    break;
                                default:
                                    const script_el = $(c_html, tagname_str)[0];
                                    script_text += script_el.innerText;
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
            };
            [
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
            ].forEach((tagname_str) => {
                while ([...$(c_html, tagname_str)].length > 0) {
                    const tags = [...$(c_html, tagname_str)];
                    tags.forEach((el) => tag_changer(el, tagname_str));
                }
            });
            [...$(c_html, "*")].forEach((el) => {
                [...el.attributes].forEach((attr) => {
                    const bind = attr.name === "bind";
                    const custom_event = attr.name.substring(0, 7) === "custom:";
                    const input = el.tagName.toLowerCase() === "input";
                    const textarea = el.tagName.toLowerCase() === "textarea";
                    if (attr.name.substring(0, 1) === ":" || custom_event) {
                        let custom_name = "";
                        if (custom_event)
                            custom_name = `custom-`;
                        el.setAttribute(`${data_attr}${custom_name}${attr.name.split(":")[1]}`, attr.value);
                        el.removeAttribute(attr.name);
                    }
                    else if (bind && el.tagName.toLowerCase() === "select") {
                        el.setAttribute(`data-bay-custom-select-${bay_instance_id}`, `$bay_select_bind(e, ${attr.value})`);
                        if (el.hasAttribute("multiple")) {
                            el.setAttribute(`multiple`, "true");
                        }
                        el.removeAttribute(attr.name);
                        el.innerHTML = `\${${attr.value}.map((item)=>{return \`&lt;option \${(()=>{return Object.entries(item).map((o)=> \`\${o[0]}="\${o[1]}"\` ).join(' ')})()}>\${item.text}&lt;/option>\`}).join('')}`;
                        has_select_bind = true;
                    }
                    else if (bind && (input || textarea)) {
                        el.setAttribute(`${data_attr}input`, `${attr.value} = e.target.value`);
                        el.removeAttribute(attr.name);
                        el.setAttribute(`value`, `\${${attr.value}}`);
                    }
                    else if (attr.name.substring(0, 5) === "bind:" &&
                        (input || textarea)) {
                        el.setAttribute(`${data_attr}${attr.name.split(":")[1]}`, `${attr.value} = e.target.value`);
                        el.removeAttribute(attr.name);
                        el.setAttribute(`value`, `\${${attr.value}}`);
                    }
                });
            });
            if (has_select_bind) {
                window.bay.apply_select = (e, array) => {
                    [...e.target.options].forEach((option, i) => {
                        if (array[i].selected) {
                            option.selected = true;
                            option.setAttribute("selected", "true");
                        }
                        else {
                            option.selected = false;
                            option.removeAttribute("selected");
                        }
                    });
                    e.target.onchange = (e2) => {
                        [...e2.target.options].forEach((option, i) => {
                            if (option.selected) {
                                array[i].selected = true;
                            }
                            else {
                                array[i].selected = false;
                            }
                        });
                    };
                };
            }
            script = script_text;
            // apply passed attributes =========================================
            observedAttributes_from_element = attrs;
        }
        catch (error) {
            console.error(error);
        }
        if (!tag) {
            console.error("Something went wrong loading file " + file_name + ".");
            return;
        }
        class BAY extends HTMLElement {
            constructor() {
                super();
                this.mounted = false;
                this.tmp = `${c_html.innerHTML}`;
                this.uniqid = makeid(8);
                this.CSP = false;
                this.dsd = false;
                this.debouncer = false;
                this.prefixes = [];
                this.evt_prefixes = [];
                this.eventHandlers = new Map();
                const inner_el = this.getAttribute("inner-html");
                if (inner_el) {
                    if ($(document, inner_el)[0]) {
                        this.inner_el = $(document, inner_el)[0];
                    }
                    else {
                        console.error("inner-html target " + inner_el + " not found.");
                    }
                }
                else {
                    this.inner_el = this;
                }
                document.addEventListener("securitypolicyviolation", (e) => {
                    e.preventDefault();
                    if (e.violatedDirective.indexOf("script-src") > -1 ||
                        e.violatedDirective.indexOf("style-src") > -1) {
                        if (e.blockedURI === "blob") {
                            console.warn("blob: needed in script-src/style-src CSP");
                            this.CSP = true;
                        }
                    }
                });
                // shadow dom setup ===============================================
                if (this.shadowRoot) {
                    this.shadowDom = this.shadowRoot;
                    const wrapper = document.createElement("div");
                    wrapper.id = "bay";
                    [...this.shadowDom.children].map((node) => wrapper.appendChild(node));
                    this.shadowRoot.appendChild(wrapper);
                    this.dsd = true;
                }
                else {
                    this.attachShadow({
                        mode: "open",
                    });
                    this.shadowDom = this.shadowRoot;
                    let template = document.createElement("template");
                    template.innerHTML = /*HTML*/ `<div id="bay"></div>`;
                    this.shadowDom.appendChild(template.content.cloneNode(true));
                }
                // local proxy setup =============================================
                this.shadowDom.proxy = make_proxy_object({}, () => {
                    render_debouncer(this);
                });
                this.shadowRootHTML = $(this.shadowDom, "#bay")[0];
                window.bay[this.uniqid] = this.shadowDom;
                [...attrs].forEach((attr) => {
                    this.shadowDom.proxy[attr.att] = attr.value;
                });
                window.bay[this.uniqid][element_name] = this;
                this.oldEvents = ``;
                // blob strings setup ============================================
                if (!script) {
                    script = "/* No script tag found */";
                }
                // for getting the component's root element ======================
                this.shadowDom.uniqid = this.uniqid;
                const rootNode = this.getRootNode();
                let parent_var = ``;
                let parent_event_var = ``;
                let parent_uniqid = ``;
                if (rootNode.host) {
                    parent_var = `const $parent=window.bay[parent_uniqid]['proxy'];\n`;
                    parent_event_var = `const $parent=window.bay['${rootNode.host.uniqid}']['proxy'];\n`;
                    parent_uniqid = rootNode.host.uniqid;
                }
                const local_var = `const ${local_name}=window.bay[bay_uniqid];\n`;
                const local_evevt_var = `const ${local_name}=window.bay['${this.uniqid}'];\n`;
                const global_var = `const ${store_name}=window.bay.global;\n`;
                const route_var = `const ${route_name}=window.bay.route;\n`;
                const element_var = `const ${element_name}=${local_name}['${element_name}'];\n`;
                // add update function ===========================================
                this.update_evt = new CustomEvent(`bay_local_update_event_${this.uniqid}`);
                let update_func = ``;
                if (this.tmp.indexOf(`/*props updates*/`) > -1) {
                    update_func = `let $props;\nwindow.addEventListener(\`bay_local_update_event_\${bay_uniqid}\`,()=>$props());\n`;
                }
                // add slotchange function =======================================
                let slotchange_func = ``;
                if (this.tmp.indexOf(`/*slotchange updates*/`) > -1) {
                    update_func = `let $slotchange=()=>{};\nlet $details={'element':'','changed':''};\nwindow.addEventListener(\`bay_slotchange_event_\${bay_uniqid}\`,(e)=>$slotchange(e));\n`;
                }
                // add decode & encode functions =================================
                window.bay.decode = decodeHtml;
                const decode_var = `$bay.decode=window.bay.decode;\n`;
                window.bay.encode = escapeHTML;
                const encode_var = `$bay.encode=window.bay.encode;\n`;
                // add update route function =====================================
                window.bay.update_route = update_route;
                let route_update_var = ``;
                if (has_route) {
                    route_update_var = `$bay.update_route=window.bay.update_route;\n`;
                }
                // add slotchange event ==========================================
                window.bay[this.uniqid].addEventListener("slotchange", (e) => {
                    this.local_evt = new CustomEvent(`bay_slotchange_event_${this.uniqid}`, { detail: { element: e.target, changed: "slotchange" } });
                    window.dispatchEvent(this.local_evt);
                });
                let bay_slots = $(this, "*");
                bay_slots.forEach((slot) => {
                    const slot_observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.type === "attributes") {
                                this.local_evt = new CustomEvent(`bay_slotchange_event_${this.uniqid}`, { detail: { element: slot, changed: "attributes" } });
                                window.dispatchEvent(this.local_evt);
                            }
                            else if (mutation.type === "childList") {
                                this.local_evt = new CustomEvent(`bay_slotchange_event_${this.uniqid}`, { detail: { element: slot, changed: "childList" } });
                                window.dispatchEvent(this.local_evt);
                            }
                        });
                    });
                    slot_observer.observe(slot, { attributes: true, childList: true });
                });
                // add inner-html vars ==========================================
                let inner_html_var = ``;
                let inner_html_reset = ``;
                let inner_html_fn = ``;
                if (has_inner_html) {
                    inner_html_var = `let $bay_inner_html='';\n`;
                    inner_html_reset = ` $bay_inner_html=''; `;
                    inner_html_fn = `\n$bay.inner_html=()=>{return $bay_inner_html;};`;
                }
                // add select bind ==============================================
                let select_bind_var = ``;
                if (has_select_bind) {
                    select_bind_var = `const $bay_select_bind=window.bay.apply_select;\n`;
                }
                // add on ==========================================
                let on_var = ``;
                if (has_on) {
                    on_var = `$bay.on=(name,callback)=>{window.addEventListener(name,e=>callback(e));};\n`;
                }
                // add emit ==========================================
                let emit_var = `$bay.emit=window.bay.emit;\n$bay.receive=window.bay.receive;\n${on_var}function bay_receive_fn(e){$bay.receive($bay,$el,e.detail.name,e.detail.data);}\nwindow.removeEventListener('bay_emit',bay_receive_fn);\nwindow.addEventListener('bay_emit',bay_receive_fn);\n`;
                this.prefixes = [
                    local_var,
                    global_var,
                    route_var,
                    element_var,
                    parent_var,
                    inner_html_var,
                    encode_var,
                    decode_var,
                    update_func,
                    slotchange_func,
                    route_update_var,
                    emit_var,
                ];
                this.evt_prefixes = [
                    local_evevt_var,
                    global_var,
                    route_var,
                    element_var,
                    parent_event_var,
                    encode_var,
                    decode_var,
                    route_update_var,
                    select_bind_var,
                ];
                const proxy_script = this.prefixes.join("") +
                    decodeHtml(script)
                        .replaceAll("this[", `${local_name}.proxy[`)
                        .replaceAll("this.", `${local_name}.proxy.`)
                        .replace(/(^[ \t]*\n)/gm, "");
                const proxy_html = decodeHtml(this.tmp)
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
                addBlob(this, revoke_blob, element_tagname, `${proxy_script}\n${local_name}.template=()=>{${inner_html_reset}return \`${proxy_html}\`;};\n${local_name}.styles=()=>{return \`${proxy_css}\`;};${inner_html_fn}`, parent_uniqid, import_script);
                this.hasAdopted = false;
                if ("adoptedStyleSheets" in document) {
                    this.hasAdopted = true;
                }
                if (this.hasAdopted) {
                    this.sheet = new CSSStyleSheet();
                    this.sheet.replaceSync(proxy_css);
                    this.shadowDom.adoptedStyleSheets = [this.sheet];
                }
                else {
                    const blob = new Blob([proxy_css], {
                        type: "text/css",
                    });
                    const blobUrl = URL.createObjectURL(blob);
                    const styleLink = document.createElement("link");
                    styleLink.rel = "stylesheet";
                    styleLink.href = blobUrl;
                    this.shadowDom.appendChild(styleLink);
                    styleLink.id = "bay-style";
                    const styleLinkUpdate = document.createElement("link");
                    styleLinkUpdate.id = "bay-style-update";
                    styleLinkUpdate.href = blobUrl;
                    styleLinkUpdate.rel = "stylesheet";
                    this.shadowDom.appendChild(styleLinkUpdate);
                    this.styleLinkUpdate = styleLinkUpdate;
                }
            }
            /**
             * Renders the component from proxy data changes
             */
            render() {
                if (this.CSP) {
                    this.shadowDom.innerHTML = "";
                    return;
                }
                if (!this.tmp || !this.shadowRootHTML.innerHTML) {
                    return;
                }
                if (typeof window.bay[this.uniqid].template !== "function") {
                    return;
                }
                try {
                    // Diff the DOM and template
                    if (has_inner_html) {
                        render_innerHTML(this.uniqid, this.inner_el);
                    }
                    render_shadowDOM(this.uniqid, this.shadowRootHTML);
                    // Events and Styles
                    if (has_inner_html) {
                        add_events(this, [
                            ...$(this.inner_el, "*"),
                            ...$(this.shadowRootHTML, "*"),
                        ]);
                    }
                    else {
                        add_events(this, [...$(this.shadowRootHTML, "*")]);
                    }
                    set_styles(this);
                    if (has_select_bind) {
                        const attr_name = `[data-bay-custom-select-${bay_instance_id}]`;
                        let els = [];
                        if (has_inner_html) {
                            els = [
                                ...$(this.inner_el, attr_name),
                                ...$(this.shadowRootHTML, attr_name),
                            ];
                        }
                        else {
                            els = [...$(this.shadowRootHTML, attr_name)];
                        }
                        els.forEach((el) => {
                            el.dispatchEvent(new CustomEvent(`select-${bay_instance_id}`));
                        });
                    }
                    if (this.mounted === false && window.bay[this.uniqid]["$mounted"]) {
                        this.mounted = true;
                        setTimeout(() => {
                            window.bay[this.uniqid]["$mounted"]();
                        }, 14);
                    }
                    if ($(this.shadowDom, "[bay]")[0]) {
                        get_all_bays(this.shadowDom);
                    }
                    if (this.hasAttribute("fouc")) {
                        this.removeAttribute("fouc");
                    }
                }
                catch (error) {
                    console.error(error);
                }
            }
            connectedCallback() {
                try {
                    if (has_globals) {
                        window.addEventListener("bay_global_event", (e) => {
                            render_debouncer(this);
                        });
                    }
                    if (has_route) {
                        window.addEventListener("bay_route_event", (e) => {
                            render_debouncer(this);
                        });
                    }
                }
                catch (error) {
                    console.error(error);
                }
            }
            static get observedAttributes() {
                return observedAttributes_from_element;
            }
            attributeChangedCallback(name, oldValue, newValue) {
                if (oldValue !== newValue) {
                    this.shadowDom.proxy[name] = newValue;
                    // trigger an event for the bay with uniqid
                    window.dispatchEvent(this.update_evt);
                }
            }
        }
        // define the component
        customElements.define(tag, BAY);
    }
    // ------------------------------
    window.addEventListener("load", () => {
        get_all_bays(document);
    });
    bay.refresh = () => {
        get_all_bays(document);
    };
    window.bay.refresh = bay.refresh;
    bay.create = create_template_fn;
    window.bay.create = bay.create;
};
//bay();
export default bay;
