// Column resizer module

export function initColumnResizers() {
  const table = document.getElementById('message-table');
  if (!table) return;

  const resizers = table.querySelectorAll('.col-resizer');
  let currentResizer = null;
  let startX = 0;
  let startWidth = 0;
  let headerCell = null;
  let colClass = '';

  resizers.forEach(resizer => {
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      currentResizer = resizer;
      headerCell = resizer.parentElement;
      colClass = resizer.dataset.col;
      startX = e.pageX;
      startWidth = headerCell.offsetWidth;

      resizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });

  function onMouseMove(e) {
    if (!currentResizer || !headerCell || !colClass) return;

    const diff = e.pageX - startX;
    const newWidth = Math.max(40, startWidth + diff);

    table.style.setProperty('--col-' + colClass + '-width', newWidth + 'px');

    if (colClass === 'data') {
      const dataCells = table.querySelectorAll('.col-data');
      dataCells.forEach(cell => {
        cell.style.flex = 'none';
      });
    }
  }

  function onMouseUp() {
    if (currentResizer) {
      currentResizer.classList.remove('resizing');
    }
    currentResizer = null;
    headerCell = null;
    colClass = '';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}
