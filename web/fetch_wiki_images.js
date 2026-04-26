const fs = require('fs');
const envStr = fs.readFileSync('.env.local', 'utf8');
for (const line of envStr.split('\n')) {
  if (line.includes('=') && !line.startsWith('#')) {
    const [k, ...v] = line.split('=');
    process.env[k.trim()] = v.join('=').trim().replace(/(^"|"$)/g, '');
  }
}

async function main() {
  const { createClient } = require('@supabase/supabase-js');
  const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {auth:{persistSession:false}});
  const { data } = await c.from('votometro_directory_public').select('canonical_name');
  if (!data) return;
  
  const cache = {};
  console.log("Fetching images for", data.length, "legislators...");
  
  const batchSize = 10;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await Promise.all(batch.map(async (row) => {
      const name = row.canonical_name;
      try {
        const res = await fetch(`https://es.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(name)}&prop=pageimages&format=json&pithumbsize=300`);
        const json = await res.json();
        const pages = json.query.pages;
        const pageId = Object.keys(pages)[0];
        if (pageId !== "-1" && pages[pageId].thumbnail) {
          cache[name] = pages[pageId].thumbnail.source;
        }
      } catch (e) {}
    }));
    process.stdout.write('.');
  }
  fs.writeFileSync('lib/wiki_images.json', JSON.stringify(cache, null, 2));
  console.log("\nDone! Saved", Object.keys(cache).length, "images.");
}
main();
