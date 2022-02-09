async function joinChunks(chunks) {
  let result = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    result.push(chunk.toString());
  }

  return result.join("");
}

module.exports = { joinChunks };
