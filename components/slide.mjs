export default /*HTML*/`
<div 
  id="container-content"
  :style="\${this.slide_style()}"
  :transitionend="this.transition_end()">
  <slot></slot>
</div>
<script>
  this.container_content_height = 0;
  this.slide = (open) => {
    const element = $bay.querySelector('#container-content');
    const now_height = element.getBoundingClientRect().height;
    let height = 0;
    if (open === 'true') {
      element.style.height = 'auto';
      height = element.getBoundingClientRect().height;
    }
    element.style.height = now_height + 'px';
    this.container_content_height = height + 'px';
  };
  this.transition_end = () => {
    if (this.open === 'true') {
      this.container_content_height = 'auto';
    }
  }
  this.slide_style = () => {
    return \`overflow: hidden; box-sizing: border-box; height: \${this.container_content_height}; transition: height \${this.transition || '.25s ease'};\`;
  };
</script>
<script props>
  this.slide(this.open);
</script>
<script mounted>
  if (this.open === 'true') {
    this.container_content_height = 'auto';
  } else if (this.open === 'false') {
    this.container_content_height = '0px';
  }
</script>`;