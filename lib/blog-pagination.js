function visiblePageItems(current, total) {
  const last = Math.max(1, Number(total) || 1);
  const page = Math.min(Math.max(1, Number(current) || 1), last);
  if (last <= 5) return Array.from({ length: last }, (_, index) => index + 1);
  if (page <= 3) return [1, 2, 3, "ellipsis", last];
  if (page >= last - 2) return [1, "ellipsis", last - 2, last - 1, last];
  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", last];
}

function blogPageHref(page) {
  const safe = Math.max(1, Number.parseInt(page, 10) || 1);
  return safe <= 1 ? "/blog" : `/blog?page=${safe}`;
}

module.exports = {
  blogPageHref,
  visiblePageItems,
};
