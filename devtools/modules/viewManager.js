// View management module

let elements = {};

export function initViewManager(el) {
  elements = el;
}

export function showListView() {
  elements.messageListView.classList.add('active');
  elements.detailView.classList.remove('active');
}

export function showDetailView() {
  elements.messageListView.classList.remove('active');
  elements.detailView.classList.add('active');
}
