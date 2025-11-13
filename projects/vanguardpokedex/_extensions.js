String.prototype.toTitleCase = function(characterSplitter = ' ', joinByCharacter = ' ') {
  return this.toLowerCase().split(characterSplitter).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(joinByCharacter);
}

String.prototype.FromCaseToSpace = function() {
  return this.replace(/([a-z])([A-Z])/g, '$1 $2').toTitleCase();
}

// Normalizes a name by converting to lowercase and removing spaces, hyphens, and periods
String.prototype.normalizeName = function () {
  return this.toLowerCase().replace(/[\s\-.]/g, '');
}

Array.prototype.unique = function() {
  return [...new Set(this)];
}

// Flag to indicate that extensions have been loaded 
window.extensionsLoaded = true;