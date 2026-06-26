// HeroKit Figma Plugin — main thread
// Receives image bytes from UI iframe and inserts as a filled rectangle

figma.showUI(__html__, { width: 340, height: 320, title: 'HeroKit' });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'insert-image') {
    const bytes = new Uint8Array(msg.bytes);
    const image = figma.createImage(bytes);

    // Use selected frame/rectangle if available, otherwise create a new one
    const sel = figma.currentPage.selection;
    let node;

    if (sel.length === 1 && (sel[0].type === 'RECTANGLE' || sel[0].type === 'FRAME')) {
      node = sel[0];
    } else {
      node = figma.createRectangle();
      node.x = figma.viewport.center.x - msg.width / 2;
      node.y = figma.viewport.center.y - msg.height / 2;
      node.resize(msg.width, msg.height);
      node.name = 'HeroKit Background';
      figma.currentPage.appendChild(node);
    }

    node.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    figma.closePlugin('✓ HeroKit image inserted');
  }

  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};
