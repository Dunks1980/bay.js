export default /*HTML*/`
<div 
  id="container-background"
  class="container-background \${this.bg} \${this.open}" 
  :click="$el.setAttribute('open', 'false'); this.closed_callback()" 
  :style="\${this.background_style()}" 
  :transitionend="this.transition_end()" 
  :transitionstart="this.transition_start()"
  :transitioncancel="this.transition_cancel()"
  >
  <div id="container-content" :click="e.stopPropagation();" :style="\${this.content_style()}">
    <div id="content-wrap">
      <slot></slot>
    </div>
  </div>
</div>

<script>
  this.background_style = () => {
    return \`box-sizing: border-box; display: \${this.display}; transition: all \${this.duration} ease;\`;
  }
  this.content_style = () => {
    return \` 
      overflow: hidden;
      left: \${this.left};
      top: \${this.top};
      transform: translate(\${this.translateX}, \${this.translateY}) scale(\${this.scale});
      opacity: \${this.opacity};
      display: \${this.display};
      transition: all \${this.duration} \${this.curve};\`;
  }
  this.transition_start = () => {
    this.transitionCounter++;
  }
  this.transition_cancel = () => {
    this.transitionCounter--;
  }
  this.transition_end = () => {
    this.transitionCounter--;
    if(this.transitionCounter === 0) {
      let el = $bay.getElementById('container-background');
      let test = window.getComputedStyle(el).getPropertyValue("pointer-events");
      if (test === 'none') {
        this.display = 'none';
        this.bg = '';
        this.closed_callback();
      }
    }
  }
  this.closed_callback = () => {
    if (this.closed && typeof $parent[this.closed] === 'function') {
      $parent[this.closed]();
    }
  }
  const pos_fn = () => {
    let pos_obj = {};
    switch (this.position) {
      case 'left':
        pos_obj.open_x = '0%';
        pos_obj.close_x = '-100%';
        pos_obj.open_y = '0%';
        pos_obj.close_y = '0%';
        pos_obj.left = '0%';
        pos_obj.top = '0%';
        pos_obj.open_scale = '1';
        pos_obj.close_scale = '1';
        pos_obj.open_opacity = '1';
        pos_obj.close_opacity = '1';
        break;
      case 'right':
        pos_obj.open_x = '-100%';
        pos_obj.close_x = '0%';
        pos_obj.open_y = '0%';
        pos_obj.close_y = '0%';
        pos_obj.left = '100%';
        pos_obj.top = '0%';
        pos_obj.open_scale = '1';
        pos_obj.close_scale = '1';
        pos_obj.open_opacity = '1';
        pos_obj.close_opacity = '1';
        break;
      case 'center':
        pos_obj.open_x = '-50%';
        pos_obj.close_x = '-50%';
        pos_obj.open_y = '-50%';
        pos_obj.close_y = '-50%';
        pos_obj.left = '50%';
        pos_obj.top = '50%';
        pos_obj.open_scale = '1';
        pos_obj.close_scale = '.5';
        pos_obj.open_opacity = '1';
        pos_obj.close_opacity = '0';
        break;
    }
    return pos_obj;
  }
  this.modal = () => {
    const elementbg = $bay.querySelector('.container-background');
    const element = $bay.querySelector('#container-content');
    let x = pos_fn().open_x;
    let y = pos_fn().open_y;
    let el_scale = pos_fn().open_scale;
    let el_opacity = pos_fn().open_opacity;
    if (this.open === 'true') {
      element.style.display = 'inline-block';
      elementbg.style.display = 'block';
      this.display = 'inline-block';
      this.displaybg = 'block';
      this.bg = ' open';
    } else if (this.open === 'false') {
      x = pos_fn().close_x;
      y = pos_fn().close_y;
      el_scale = pos_fn().close_scale;
      el_opacity = pos_fn().close_opacity;
      this.bg = '';
    }
    this.left = pos_fn().left;
    this.top = pos_fn().top;
    this.translateX = x;
    this.translateY = y;
    this.scale = el_scale;
    this.opacity = el_opacity;
  };
  this.transitionCounter = 0;
  this.open = this.open || false;
  this.closed = this.closed || false;
  this.bg = '';
  this['bg-color'] = this['bg-color'] || 'rgba(0,0,0,.5)';
  this.position = this.position || 'center';
  this.translateX = pos_fn().close_x || '0%';
  this.translateY = pos_fn().close_y || '0%';
  this.scale = pos_fn().close_scale || '1';
  this.opacity = pos_fn().close_opacity || '1';
  this.left = pos_fn().left || '0%';
  this.top = pos_fn().top || '0%';
  this.display = 'none';
  this.displaybg = 'none';
  this.duration = this.duration || '.25s';
  this.curve = this.curve || 'ease';
  this.refresh = 0;
</script>
<script props>
  this.modal();
</script>
<script mounted>
  this.left = pos_fn().left;
  this.top = pos_fn().top;
  if (this.open === 'true') {
    this.translateX = pos_fn().open_x;
    this.translateY = pos_fn().open_y;
    this.scale = pos_fn().open_scale;
  } else if (this.open === 'false') {
    this.translateX = pos_fn().close_x;
    this.translateY = pos_fn().close_y;
    this.scale = pos_fn().close_scale;
  }
</script>
<style>
  .container-background {
    overflow: hidden;
    position: fixed;
    inset: 0;
    z-index: 1;
    background: transparent;
    pointer-events: none;
    user-select: none;
  }
  .container-background.open {
    opacity: 1;
    pointer-events: all;
    background: "\${this['bg-color']}";
  }
  #container-content {
    position: relative;
    z-index: 2;
    pointer-events: none;
  }
  #container-content>* {
    pointer-events: all;
    user-select: auto;
  }
  #content-wrap {
    max-width: 100vw;
    box-sizing: border-box;
    display: inline-block;
  }
</style>`;