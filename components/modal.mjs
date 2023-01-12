export default /*HTML*/`
<div class="container-background \${this.bg}" :click="$el.setAttribute('open', 'false');" :style="
    display: \${this.display};
    transition: all \${this.duration} ease;
  " :transitionend="this.transition_end()">
  <div id="container-content" :click="e.stopPropagation();" :style="
      overflow: hidden;
      left: \${this.left};
      top: \${this.top};
      transform: translate(\${this.translateX}, \${this.translateY}) scale(\${this.scale});
      opacity: \${this.opacity};
      display: \${this.display};
      transition: all \${this.duration} \${this.curve};
    ">
    <div id="content-wrap">
      <slot></slot>
    </div>
  </div>
</div>
<script>
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
  function pos_fn() {
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
  this.modal = (open) => {
    const elementbg = $bay.querySelector('.container-background');
    const element = $bay.querySelector('#container-content');
    const wrap = $bay.querySelector('#content-wrap');
    const el_width = wrap.getBoundingClientRect().width;
    let x = pos_fn().open_x;
    let y = pos_fn().open_y;
    let el_scale = pos_fn().open_scale;
    let el_opacity = pos_fn().open_opacity;
    if (open === 'true') {
      element.style.display = 'inline-block';
      elementbg.style.display = 'block';
      this.display = 'inline-block';
      this.displaybg = 'block';
      this.bg = ' open';
    } else if (open === 'false') {
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
  this.transition_end = () => {
    if (this.open !== 'true') {
      this.display = 'none';
      this.displaybg = 'none';
    }
  }
</script>
<script props>
  this.modal(this.open);
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
  }
  #content-wrap {
    max-width: 100vw;
    box-sizing: border-box;
    display: inline-block;
  }
</style>`;