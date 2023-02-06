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
  });
  this.a_el = \`<a bay-route :click="e.preventDefault();history.pushState({},'',e.target.getAttribute('href'));$bay.update_route();"\${el_attrs}>\${$el.innerHTML}</a>\`;
</script>
`;