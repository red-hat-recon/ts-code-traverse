const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const babelParser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

// Function to process a single file
function processFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const identifierMap = {};

  try {
    // Parse the file
    const ast = babelParser.parse(content, {
      sourceType: "module",
      plugins: ["jsx", "typescript"], // Add plugins as needed
    });

    // Traverse the AST to collect identifiers
    traverse(ast, {
      FunctionDeclaration(path) {
        const name = path.node.id.name;
        identifierMap[name] = {
          type: "function",
          content: path.toString(),
          file: filePath,
          line: path.node.loc.start.line,
        };
      },
      VariableDeclarator(path) {
        const name = path.node.id.name;
        const init = path.node.init ? path.get("init").toString() : "undefined";
        identifierMap[name] = {
          type: "variable",
          content: init,
          file: filePath,
          line: path.node.loc.start.line,
        };
      },
      ClassDeclaration(path) {
        const name = path.node.id.name;
        identifierMap[name] = {
          type: "class",
          content: path.toString(),
          file: filePath,
          line: path.node.loc.start.line,
        };
      },
    });
  } catch (error) {
    console.error(`Error processing file: ${filePath}`);
    console.error(`Syntax error: ${error.message}`);
  }

  return identifierMap;
}

// Function to process a directory recursively
function processDirectory(dirPath) {
  const allIdentifiers = {};

  fs.readdirSync(dirPath).forEach((file) => {
    const filePath = path.join(dirPath, file);

    if (fs.statSync(filePath).isDirectory()) {
      const nestedIdentifiers = processDirectory(filePath);
      Object.assign(allIdentifiers, nestedIdentifiers);
    } else if (filePath.endsWith(".js") || filePath.endsWith(".ts")) {
      const fileIdentifiers = processFile(filePath);
      Object.assign(allIdentifiers, fileIdentifiers);
    }
  });

  return allIdentifiers;
}

// Function to process a mix of directories and files
function processSources(sources, outputDir) {
  sources.forEach((source) => {
    const sourcePath = path.resolve(source);
    const outputFileName = `${path.basename(sourcePath)}.json`;
    const outputFilePath = path.join(outputDir, outputFileName);

    let result = {};
    if (fs.statSync(sourcePath).isDirectory()) {
      console.log(`Processing directory: ${sourcePath}`);
      result = processDirectory(sourcePath);
    } else if (fs.statSync(sourcePath).isFile()) {
      console.log(`Processing file: ${sourcePath}`);
      result = processFile(sourcePath);
    } else {
      console.error(`Invalid source: ${sourcePath}`);
      return;
    }

    // Save the results to a JSON file
    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2), "utf-8");
    console.log(`Identifiers extracted. Results saved to ${outputFilePath}`);
  });
}

// Main function
function main() {
  const configFilePath = path.resolve(__dirname, "config.yaml");

  // Check if the config file exists
  if (!fs.existsSync(configFilePath)) {
    console.error(`Configuration file not found at: ${configFilePath}`);
    process.exit(1);
  }

  const config = yaml.load(fs.readFileSync(configFilePath, "utf-8"));
  const inputSources = config.input_source || [];
  const outputDir = path.resolve(config.output_directory || "./outputs");

  // Ensure the output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Process the input sources
  processSources(inputSources, outputDir);
}

// Run the script
main();
