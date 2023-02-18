export default /*HTML*/`
<slot></slot>
<inner-html>\${$bay.decode(this.a_el)}</inner-html>
<script>
  let el_attrs = '';
  let attrs_arr = [...$el.attributes] || [];
  attrs_arr.forEach((attr) => {
    if (attr.value !== '' && attr.name !== '') {
      el_attrs += \` \${attr.name}="\${attr.value}"\`;
    }
    $el.removeAttribute(attr.name);
  });
  this.get_route = (e) => {
    e.preventDefault();history.pushState({},'',e.target.getAttribute('href'));$bay.update_route();
  }
  this.a_el = \`<a bay-route data-bay-click="this.get_route(e)"\${el_attrs}>\${$el.innerHTML}</a>\`;
</script>
`;