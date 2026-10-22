export default /*HTML*/`
<slot></slot>
<inner-html>
  <a bay-route href="\${this.href}" this-attribute="this.link_attributes"
     :click="this.get_route(e)">\${this.content}</a>
</inner-html>
<script>
  const href = $el.getAttribute('href') || '';
  // Existing light-DOM nodes are authored markup, not a string from reactive data.
  this.content = $bay.html($el.innerHTML);
  let el_attrs = [];
  let attrs_arr = [...$el.attributes];
  attrs_arr.forEach((attr) => {
    // Keep authored handlers on their original host/scope; never recompile or
    // grant HTML trust to a copied executable attribute.
    if (/^(?:on|data-bay-)/i.test(attr.name)) return;
    if (/^[a-z_][a-z0-9_:.-]*$/i.test(attr.name) &&
        !/^(?:on|data-bay-)/i.test(attr.name) &&
        !['href', 'bay', 'inner-html', 'fouc', 'this-attribute', 'srcdoc'].includes(attr.name)) {
      el_attrs.push(\`\${attr.name}="\${$bay.encode(attr.value)}"\`);
    }
    // Retain parent directive ownership markers and data on the original host.
    if (!attr.name.startsWith('data-')) $el.removeAttribute(attr.name);
  });
  // Attribute names are constrained and values encoded before granting trust.
  this.link_attributes = $bay.html(el_attrs.join(' '));
  this.href = href;
  this.get_route = (e) => {
    e.preventDefault();history.pushState({},'',e.currentTarget.getAttribute('href'));$bay.update_route();
  }
</script>
`;
