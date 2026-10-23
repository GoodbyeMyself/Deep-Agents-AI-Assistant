// pnpm on Windows emits absolute junctions. Docker copies them as unusable D:/... links.
// Rewrite only links whose targets resolve inside this deployment's virtual store.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(process.argv[2]);
const packageName = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).name;
if (typeof packageName !== "string" || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(packageName))
  throw new Error("Deployment package name is invalid.");
const selfLink = path.join(root, "node_modules/.pnpm/node_modules", packageName);
if (!fs.statSync(path.join(root, "node_modules/.pnpm")).isDirectory())
  throw new Error("Deploy virtual store is missing.");
const links = [];
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    const stats = fs.lstatSync(filename);
    if (stats.isSymbolicLink()) { links.push(filename); continue; }
    if (stats.isDirectory()) visit(filename);
  }
}
visit(root);
for (const filename of links) {
  const original = fs.readlinkSync(filename).replaceAll("\\", "/");
  let target;
  if (/^[a-z]:\//i.test(original)) {
    const marker = "/node_modules/.pnpm/";
    const index = original.indexOf(marker);
    if (index < 0) {
      if (filename !== selfLink) throw new Error("A deployment link points outside its packaged virtual store.");
      target = root;
    } else target = path.join(root, "node_modules/.pnpm", original.slice(index + marker.length));
  } else target = path.resolve(path.dirname(filename), original);
  const relativeToRoot = path.relative(root, target);
  if (relativeToRoot.startsWith(`..${path.sep}`) || relativeToRoot === ".." || path.isAbsolute(relativeToRoot))
    throw new Error("A deployment link escapes the image package root.");
  fs.unlinkSync(filename);
  fs.symlinkSync(path.relative(path.dirname(filename), target), filename);
}
for (const filename of links) fs.realpathSync(filename);
console.log(`Validated ${links.length} portable deployment links.`);
