// @ts-nocheck
import type { Payload, CollectionSlug } from 'payload'
import sharp from 'sharp'
import cloudinary from '../lib/cloudinary'

// ─── color helpers ─────────────────────────────────────────────────────────────

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

function palette(i: number): { r: number; g: number; b: number } {
  const h = ((i * 137.508) % 360) / 360
  const s = 0.65
  const l = 0.42
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  }
}

async function createMedia(
  payload: Payload,
  name: string,
  colorIndex: number,
): Promise<string | number> {
  const color = palette(colorIndex)
  const buf = await sharp({
    create: { width: 200, height: 200, channels: 3, background: color },
  })
    .jpeg({ quality: 80 })
    .toBuffer()

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  // Payload exige `file` em upload collections — o beforeChange hook
  // faz o upload pro Cloudinary (singleton já reconfigurado no início do runSeed).
  const doc = await payload.create({
    collection: 'media',
    data: { alt: name },
    file: { data: buf, mimetype: 'image/jpeg', name: `${slug}.jpg`, size: buf.length },
    overrideAccess: true,
  })

  return doc.id
}

async function fetchWikipediaThumb(...names: string[]): Promise<string | null> {
  for (const name of names) {
    for (const lang of ['en', 'pt']) {
      try {
        const res = await fetch(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, '_'))}`,
          { headers: { 'User-Agent': 'Elessar-Records-Seed/1.0' } },
        )
        if (!res.ok) continue
        const data = await res.json() as { thumbnail?: { source?: string } }
        const src = data.thumbnail?.source
        if (src) return src.replace(/\/\d+px-/, '/500px-')
      } catch { /* try next */ }
    }
  }
  return null
}

async function createMediaUrl(
  payload: Payload,
  name: string,
  colorIndex: number,
  url: string | null,
): Promise<string | number> {
  if (url) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Elessar-Records-Seed/1.0' } })
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        const ct = res.headers.get('content-type') ?? 'image/jpeg'
        const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
        const doc = await payload.create({
          collection: 'media',
          data: { alt: name },
          file: { data: buf, mimetype: ct, name: `${slug}.${ext}`, size: buf.length },
          overrideAccess: true,
        })
        return doc.id
      }
    } catch { /* fall through to placeholder */ }
  }
  return createMedia(payload, name, colorIndex)
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function richText(text: string) {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', text, version: 1, detail: 0, format: 0, mode: 'normal', style: '' }],
          direction: 'ltr',
          format: '',
          indent: 0,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

// ─── data ─────────────────────────────────────────────────────────────────────

const GENRES = [
  { name: 'Rock',               desc: 'O gênero que definiu gerações de rebeldia e expressão.' },
  { name: 'Hard Rock',          desc: 'Rock pesado com riffs poderosos e energia intensa.' },
  { name: 'Heavy Metal',        desc: 'Metal clássico com distorção máxima e temática épica.' },
  { name: 'Thrash Metal',       desc: 'Metal veloz e agressivo, nascido nos anos 80.' },
  { name: 'Death Metal',        desc: 'Metal extremo com vocais guturais e riffs brutais.' },
  { name: 'Black Metal',        desc: 'Metal atmosférico e obscuro, vindo da cena norueguesa.' },
  { name: 'Doom Metal',         desc: 'Metal lento, sombrio e de baixo afinado.' },
  { name: 'Power Metal',        desc: 'Metal épico e melódico com vocais potentes.' },
  { name: 'Groove Metal',       desc: 'Metal pesado com groove e ritmo irresistível.' },
  { name: 'Alternative Metal',  desc: 'Metal fora do convencional, misturando gêneros.' },
  { name: 'Progressive Metal',  desc: 'Metal técnico e experimental com estruturas complexas.' },
  { name: 'Nu Metal',           desc: 'Fusão de metal com hip-hop e elementos alternativos dos anos 90.' },
  { name: 'Stoner Rock',        desc: 'Rock pesado e psicodélico influenciado pelo blues.' },
  { name: 'Rock Nacional',      desc: 'Rock brasileiro em toda sua força e identidade.' },
  { name: 'Rock Progressivo',   desc: 'Rock experimental e instrumentalmente elaborado.' },
  { name: 'Glam Rock',          desc: 'Rock teatral e extravagante dos anos 70.' },
  { name: 'Grunge',             desc: 'O som cru e angustiado de Seattle nos anos 90.' },
  { name: 'Punk Rock',          desc: 'Velocidade, atitude e rebeldia pura.' },
  { name: 'Alternative Rock',   desc: 'Rock fora do mainstream comercial.' },
  { name: 'Indie Rock',         desc: 'Rock independente e autoral.' },
]

const CATEGORIES = [
  { name: 'Rock Nacional',        desc: 'O melhor do rock brasileiro, de Legião Urbana a Sepultura.' },
  { name: 'Rock Internacional',   desc: 'Clássicos do rock mundial, dos anos 60 ao presente.' },
  { name: 'Heavy Metal',          desc: 'Metal pesado nacional e internacional.' },
  { name: 'Thrash & Death Metal', desc: 'Os subgêneros mais extremos e técnicos do metal.' },
  { name: 'Punk Rock',            desc: 'Punk, hardcore e afins.' },
  { name: 'Rock Progressivo',     desc: 'Rock técnico, experimental e concept albums.' },
  { name: 'Grunge & Alternative', desc: 'Grunge, alternative rock e pós-punk dos anos 90.' },
  { name: 'Glam Rock',            desc: 'Glam rock e glam metal dos anos 70 e 80.' },
  { name: 'Power & Doom Metal',   desc: 'Power metal épico e doom metal sombrio.' },
  { name: 'Merchandise',          desc: 'Camisetas, moletons, patches e acessórios rock e metal.' },
]

const ARTISTS = [
  { name: 'Legião Urbana',       bio: 'Banda de rock brasiliense liderada por Renato Russo, símbolo do rock nacional.' },
  { name: 'Sepultura',           bio: 'Banda de thrash/death metal de Belo Horizonte, ícone do metal extremo mundial.' },
  { name: 'Titãs',               bio: 'Banda paulistana fundamental do rock dos anos 80, com letras urbanas e críticas.' },
  { name: 'The Beatles',         bio: 'A banda mais influente da história do rock, formada em Liverpool em 1960.' },
  { name: 'Led Zeppelin',        bio: 'Pioneiros do hard rock britânico, autores de Stairway to Heaven.' },
  { name: 'Pink Floyd',          bio: 'Banda britânica de rock progressivo, mestre das concept albums e experimentação.' },
  { name: 'The Rolling Stones',  bio: 'The Greatest Rock and Roll Band in the World, ativos desde 1962.' },
  { name: 'David Bowie',         bio: 'O Camaleão do Rock, mestre da reinvenção artística e do glam rock.' },
  { name: 'Nirvana',             bio: 'Trio de Seattle que redefiniu o rock com o grunge nos anos 90.' },
  { name: 'Black Sabbath',       bio: 'Os criadores do heavy metal, formados em Birmingham em 1968.' },
  { name: 'Iron Maiden',         bio: 'Lenda do heavy metal britânico, com Eddie como mascote imortal.' },
  { name: 'Metallica',           bio: 'A maior banda de thrash metal do mundo, formada em Los Angeles em 1981.' },
  { name: 'Pantera',             bio: 'Pioneiros do groove metal, com Phil Anselmo e o lendário Dimebag Darrell.' },
  { name: 'System of a Down',    bio: 'Banda de alternative metal armênio-americana com mensagens políticas intensas.' },
  { name: 'Judas Priest',        bio: 'Lenda do heavy metal britânico, responsáveis pela estética do couro no metal.' },
  { name: 'AC/DC',               bio: 'Banda australiana de hard rock com riffs eternos e energia inigualável.' },
  { name: 'Guns N\' Roses',      bio: 'A banda de hard rock mais perigosa de Los Angeles nos anos 80.' },
  { name: 'The Clash',           bio: 'Pioneiros do punk rock britânico, fundindo política, reggae e estilo únicos.' },
  { name: 'Radiohead',           bio: 'Banda britânica de rock alternativo e experimental, inovadores constantes.' },
  { name: 'Motörhead',           bio: 'O elo entre o punk e o metal, liderados pelo inimitável Lemmy Kilmister.' },
]

const RECORDS = [
  { title: 'Que País É Este',                     artist: 'Legião Urbana',    genre: 'Rock Nacional',    format: 'vinyl', condition: 'used', situation: [],                                year: 1987, label: 'EMI',          price: 8990,  stock: 5,  sku: 'REC-001', desc: 'Álbum marcante da fase madura da Legião Urbana.',                     featured: true },
  { title: 'Dois',                                 artist: 'Legião Urbana',    genre: 'Rock Nacional',    format: 'vinyl', condition: 'used', situation: ['collectible'],                    year: 1986, label: 'EMI',          price: 11990, stock: 3,  sku: 'REC-002', desc: 'Segundo álbum da Legião, com Eduardo e Monica e Geração Coca-Cola.' },
  { title: 'Roots',                                artist: 'Sepultura',        genre: 'Death Metal',      format: 'vinyl', condition: 'used', situation: ['rare', 'collectible'],            year: 1996, label: 'Roadrunner',   price: 34990, stock: 2,  sku: 'REC-003', desc: 'Metal extremo fundido com ritmos tribais brasileiros.',               isRare: true },
  { title: 'Beneath the Remains',                  artist: 'Sepultura',        genre: 'Thrash Metal',     format: 'vinyl', condition: 'used', situation: ['rare'],                           year: 1989, label: 'Roadrunner',   price: 28990, stock: 2,  sku: 'REC-004', desc: 'O álbum que colocou o Sepultura no mapa do thrash metal mundial.',    isRare: true },
  { title: 'Cabeça Dinossauro',                    artist: 'Titãs',            genre: 'Punk Rock',        format: 'vinyl', condition: 'used', situation: [],                                year: 1986, label: 'WEA',          price: 9990,  stock: 4,  sku: 'REC-005', desc: 'O álbum mais pesado e político dos Titãs.' },
  { title: 'Abbey Road',                           artist: 'The Beatles',      genre: 'Rock',             format: 'vinyl', condition: 'new',  situation: ['remastered'],                    year: 1969, label: 'Apple',         price: 19990, stock: 8,  sku: 'REC-006', desc: 'O penúltimo álbum dos Beatles, um clássico absoluto.',                featured: true },
  { title: 'Led Zeppelin IV',                      artist: 'Led Zeppelin',     genre: 'Hard Rock',        format: 'vinyl', condition: 'used', situation: ['collectible'],                    year: 1971, label: 'Atlantic',      price: 27990, stock: 3,  sku: 'REC-007', desc: 'Stairway to Heaven. Black Dog. Rock and Roll. O resto é história.' },
  { title: 'Physical Graffiti',                    artist: 'Led Zeppelin',     genre: 'Hard Rock',        format: 'vinyl', condition: 'used', situation: ['rare', 'imported'],               year: 1975, label: 'Swan Song',     price: 39990, stock: 1,  sku: 'REC-008', desc: 'Obra-prima dupla de Led Zeppelin, com Kashmir.',                     isRare: true },
  { title: 'The Dark Side of the Moon',            artist: 'Pink Floyd',       genre: 'Rock Progressivo', format: 'vinyl', condition: 'used', situation: ['imported'],                       year: 1973, label: 'Harvest',       price: 32990, stock: 5,  sku: 'REC-009', desc: 'O disco mais vendido da história do rock.',                          featured: true },
  { title: 'The Wall',                             artist: 'Pink Floyd',       genre: 'Rock Progressivo', format: 'vinyl', condition: 'used', situation: ['collectible'],                    year: 1979, label: 'Harvest',       price: 44990, stock: 2,  sku: 'REC-010', desc: 'Concept album épico de Roger Waters sobre alienação e isolamento.' },
  { title: 'The Rise and Fall of Ziggy Stardust',  artist: 'David Bowie',      genre: 'Glam Rock',        format: 'vinyl', condition: 'used', situation: ['collectible', 'limited_edition'],  year: 1972, label: 'RCA',           price: 24990, stock: 3,  sku: 'REC-011', desc: 'A obra-prima glam rock de David Bowie.' },
  { title: 'Nevermind',                            artist: 'Nirvana',          genre: 'Grunge',           format: 'vinyl', condition: 'used', situation: [],                                year: 1991, label: 'DGC',           price: 14990, stock: 7,  sku: 'REC-012', desc: 'O disco que mudou o rock nos anos 90.' },
  { title: 'In Utero',                             artist: 'Nirvana',          genre: 'Grunge',           format: 'vinyl', condition: 'used', situation: ['collectible'],                    year: 1993, label: 'DGC',           price: 19990, stock: 4,  sku: 'REC-013', desc: 'O último e mais cru álbum de estúdio de Kurt Cobain.' },
  { title: 'Paranoid',                             artist: 'Black Sabbath',    genre: 'Heavy Metal',      format: 'vinyl', condition: 'used', situation: ['rare', 'collectible'],            year: 1970, label: 'Vertigo',       price: 44990, stock: 1,  sku: 'REC-014', desc: 'O álbum fundador do heavy metal.',                                   isRare: true, featured: true },
  { title: 'The Number of the Beast',              artist: 'Iron Maiden',      genre: 'Heavy Metal',      format: 'vinyl', condition: 'used', situation: ['collectible'],                    year: 1982, label: 'EMI',           price: 29990, stock: 3,  sku: 'REC-015', desc: 'O álbum que cimentou o Iron Maiden como lendas absolutas do metal.' },
  { title: 'Master of Puppets',                    artist: 'Metallica',        genre: 'Thrash Metal',     format: 'vinyl', condition: 'used', situation: ['collectible', 'imported'],        year: 1986, label: 'Elektra',       price: 34990, stock: 2,  sku: 'REC-016', desc: 'Considerado o maior álbum de thrash metal de todos os tempos.',     isRare: true },
  { title: 'Vulgar Display of Power',              artist: 'Pantera',          genre: 'Groove Metal',     format: 'vinyl', condition: 'used', situation: ['collectible'],                    year: 1992, label: 'Atco',          price: 24990, stock: 4,  sku: 'REC-017', desc: 'O ápice do groove metal, com Dimebag Darrell em seu melhor.' },
  { title: 'Appetite for Destruction',             artist: 'Guns N\' Roses',   genre: 'Hard Rock',        format: 'vinyl', condition: 'used', situation: ['collectible'],                    year: 1987, label: 'Geffen',        price: 17990, stock: 5,  sku: 'REC-018', desc: 'O álbum de estreia mais vendido de todos os tempos.' },
  { title: 'London Calling',                       artist: 'The Clash',        genre: 'Punk Rock',        format: 'vinyl', condition: 'used', situation: ['imported'],                       year: 1979, label: 'CBS',           price: 18990, stock: 4,  sku: 'REC-019', desc: 'O álbum definitivo do punk rock britânico.' },
  { title: 'Ace of Spades',                        artist: 'Motörhead',        genre: 'Heavy Metal',      format: 'vinyl', condition: 'used', situation: ['rare', 'collectible'],            year: 1980, label: 'Bronze',        price: 31990, stock: 2,  sku: 'REC-020', desc: 'O álbum mais emblemático do Motörhead, velocidade e brutalidade puras.', isRare: true },
]

const APPAREL = [
  { title: 'Camiseta Sepultura – Roots',               type: 'tshirt', condition: 'new', price: 8990,  sku: 'APP-001', cat: 'Merchandise', artist: 'Sepultura',        desc: 'Camiseta com arte tribal do álbum Roots.',              sizes: ['P','M','G','GG','GGG'] },
  { title: 'Camiseta Metallica – Master of Puppets',   type: 'tshirt', condition: 'new', price: 9990,  sku: 'APP-002', cat: 'Merchandise', artist: 'Metallica',        desc: 'Camiseta com a arte clássica do Master of Puppets.',    sizes: ['PP','P','M','G','GG'] },
  { title: 'Camiseta Iron Maiden – The Trooper',       type: 'tshirt', condition: 'new', price: 9990,  sku: 'APP-003', cat: 'Merchandise', artist: 'Iron Maiden',      desc: 'Camiseta com Eddie em The Trooper.',                    sizes: ['P','M','G','GG','GGG'] },
  { title: 'Camiseta Pink Floyd – Dark Side',          type: 'tshirt', condition: 'new', price: 8990,  sku: 'APP-004', cat: 'Merchandise', artist: 'Pink Floyd',       desc: 'Camiseta com o icônico prisma do Dark Side.',           sizes: ['PP','P','M','G','GG'] },
  { title: 'Camiseta Nirvana – Nevermind',             type: 'tshirt', condition: 'new', price: 8990,  sku: 'APP-005', cat: 'Merchandise', artist: 'Nirvana',          desc: 'Camiseta com o bebê nadador do Nevermind.',             sizes: ['P','M','G','GG'] },
  { title: 'Camiseta Led Zeppelin – Zoso',             type: 'tshirt', condition: 'new', price: 9990,  sku: 'APP-006', cat: 'Merchandise', artist: 'Led Zeppelin',     desc: 'Camiseta com os quatro símbolos do Led Zeppelin IV.',   sizes: ['P','M','G','GG'] },
  { title: 'Moletom Black Sabbath – Paranoid',         type: 'hoodie', condition: 'new', price: 17990, sku: 'APP-007', cat: 'Merchandise', artist: 'Black Sabbath',    desc: 'Moletom com arte do álbum Paranoid.',                   sizes: ['P','M','G','GG','GGG'] },
  { title: 'Camiseta AC/DC – Back in Black',           type: 'tshirt', condition: 'new', price: 8990,  sku: 'APP-008', cat: 'Merchandise', artist: 'AC/DC',            desc: 'Camiseta clássica do Back in Black.',                   sizes: ['P','M','G','GG'] },
  { title: 'Moletom Pantera – Vulgar',                 type: 'hoodie', condition: 'new', price: 16990, sku: 'APP-009', cat: 'Merchandise', artist: 'Pantera',          desc: 'Moletom com arte do Vulgar Display of Power.',          sizes: ['P','M','G','GG'] },
  { title: 'Patch Sepultura – Logo',                   type: 'patch',  condition: 'new', price: 1990,  sku: 'APP-010', cat: 'Merchandise', artist: 'Sepultura',        desc: 'Patch bordado com o logo do Sepultura.',                sizes: ['unico'] },
  { title: 'Patch Iron Maiden – Eddie',                type: 'patch',  condition: 'new', price: 2490,  sku: 'APP-011', cat: 'Merchandise', artist: 'Iron Maiden',      desc: 'Patch bordado com o Eddie do Iron Maiden.',             sizes: ['unico'] },
  { title: 'Patch Motörhead – Warpig',                 type: 'patch',  condition: 'new', price: 1990,  sku: 'APP-012', cat: 'Merchandise', artist: 'Motörhead',        desc: 'Patch bordado com o Warpig do Motörhead.',              sizes: ['unico'] },
  { title: 'Camiseta The Clash – London Calling',      type: 'tshirt', condition: 'new', price: 8990,  sku: 'APP-013', cat: 'Merchandise', artist: 'The Clash',        desc: 'Camiseta com a arte da capa de London Calling.',        sizes: ['P','M','G','GG'] },
  { title: 'Jaqueta Elessar Records – Metal Edition',  type: 'jacket', condition: 'new', price: 29990, sku: 'APP-014', cat: 'Merchandise', artist: null,               desc: 'Jaqueta oficial da Elessar com logo bordado metal.',    sizes: ['P','M','G','GG'], featured: true },
  { title: 'Boné Elessar Records – Rock',              type: 'cap',    condition: 'new', price: 4990,  sku: 'APP-015', cat: 'Merchandise', artist: null,               desc: 'Boné bordado com logo da Elessar Records.',             sizes: ['unico'] },
]

const CUSTOMERS = [
  { name: 'Ana Lima',         email: 'ana.lima@email.com',         phone: '(11) 99999-1001', birthDate: '1992-03-15T00:00:00.000Z', street: 'Rua Augusta',           number: '123',  hood: 'Consolação',       city: 'São Paulo',      state: 'SP', zip: '01305-100' },
  { name: 'Bruno Ferreira',   email: 'bruno.ferreira@email.com',   phone: '(11) 99999-1002', birthDate: '1988-07-22T00:00:00.000Z', street: 'Av. Paulista',           number: '1000', hood: 'Bela Vista',       city: 'São Paulo',      state: 'SP', zip: '01310-100' },
  { name: 'Carolina Santos',  email: 'carolina.santos@email.com',  phone: '(21) 99999-1003', birthDate: '1995-11-08T00:00:00.000Z', street: 'Rua do Catete',          number: '45',   hood: 'Catete',           city: 'Rio de Janeiro', state: 'RJ', zip: '22220-010' },
  { name: 'Diego Oliveira',   email: 'diego.oliveira@email.com',   phone: '(31) 99999-1004', birthDate: '1990-01-30T00:00:00.000Z', street: 'Av. Afonso Pena',        number: '500',  hood: 'Centro',           city: 'Belo Horizonte', state: 'MG', zip: '30130-000' },
  { name: 'Elisa Rodrigues',  email: 'elisa.rodrigues@email.com',  phone: '(11) 99999-1005', birthDate: '1993-06-19T00:00:00.000Z', street: 'Rua Oscar Freire',       number: '789',  hood: 'Jardins',          city: 'São Paulo',      state: 'SP', zip: '01426-001' },
  { name: 'Felipe Costa',     email: 'felipe.costa@email.com',     phone: '(41) 99999-1006', birthDate: '1986-09-04T00:00:00.000Z', street: 'Rua XV de Novembro',     number: '200',  hood: 'Centro',           city: 'Curitiba',       state: 'PR', zip: '80020-310' },
  { name: 'Gabriela Alves',   email: 'gabriela.alves@email.com',   phone: '(51) 99999-1007', birthDate: '1997-02-14T00:00:00.000Z', street: 'Rua dos Andradas',       number: '1080', hood: 'Centro Histórico', city: 'Porto Alegre',   state: 'RS', zip: '90020-010' },
  { name: 'Henrique Mendes',  email: 'henrique.mendes@email.com',  phone: '(11) 99999-1008', birthDate: '1984-12-01T00:00:00.000Z', street: 'Rua da Consolação',      number: '234',  hood: 'Consolação',       city: 'São Paulo',      state: 'SP', zip: '01301-000' },
  { name: 'Isabela Pereira',  email: 'isabela.pereira@email.com',  phone: '(21) 99999-1009', birthDate: '1991-04-27T00:00:00.000Z', street: 'Av. Atlântica',          number: '1702', hood: 'Copacabana',       city: 'Rio de Janeiro', state: 'RJ', zip: '22021-001' },
  { name: 'João Nascimento',  email: 'joao.nascimento@email.com',  phone: '(85) 99999-1010', birthDate: '1989-08-11T00:00:00.000Z', street: 'Rua Senador Pompeu',     number: '300',  hood: 'Centro',           city: 'Fortaleza',      state: 'CE', zip: '60025-080' },
  { name: 'Karina Barbosa',   email: 'karina.barbosa@email.com',   phone: '(11) 99999-1011', birthDate: '1996-05-03T00:00:00.000Z', street: 'Av. Brasil',             number: '456',  hood: 'Pinheiros',        city: 'São Paulo',      state: 'SP', zip: '05409-000' },
  { name: 'Lucas Carvalho',   email: 'lucas.carvalho@email.com',   phone: '(71) 99999-1012', birthDate: '1987-10-18T00:00:00.000Z', street: 'Av. Sete de Setembro',   number: '100',  hood: 'Centro',           city: 'Salvador',       state: 'BA', zip: '40060-001' },
  { name: 'Mariana Gomes',    email: 'mariana.gomes@email.com',    phone: '(11) 99999-1013', birthDate: '1994-07-09T00:00:00.000Z', street: 'Rua Haddock Lobo',       number: '595',  hood: 'Cerqueira César',  city: 'São Paulo',      state: 'SP', zip: '01414-001' },
  { name: 'Nelson Araújo',    email: 'nelson.araujo@email.com',    phone: '(27) 99999-1014', birthDate: '1983-03-25T00:00:00.000Z', street: 'Av. N. Sra. da Penha',   number: '1600', hood: 'Santa Lúcia',      city: 'Vitória',        state: 'ES', zip: '29045-402' },
  { name: 'Olivia Martins',   email: 'olivia.martins@email.com',   phone: '(62) 99999-1015', birthDate: '1998-01-20T00:00:00.000Z', street: 'Av. Goiás',              number: '300',  hood: 'Centro',           city: 'Goiânia',        state: 'GO', zip: '74015-015' },
  { name: 'Pedro Sousa',      email: 'pedro.sousa@email.com',      phone: '(11) 99999-1016', birthDate: '1990-11-12T00:00:00.000Z', street: 'Rua Vergueiro',          number: '1000', hood: 'Vila Mariana',     city: 'São Paulo',      state: 'SP', zip: '04101-000' },
  { name: 'Renata Vieira',    email: 'renata.vieira@email.com',    phone: '(92) 99999-1017', birthDate: '1985-06-30T00:00:00.000Z', street: 'Av. Eduardo Ribeiro',    number: '520',  hood: 'Centro',           city: 'Manaus',         state: 'AM', zip: '69010-001' },
  { name: 'Samuel Castro',    email: 'samuel.castro@email.com',    phone: '(11) 99999-1018', birthDate: '1993-09-07T00:00:00.000Z', street: 'Rua Pamplona',           number: '145',  hood: 'Jardim Paulista',  city: 'São Paulo',      state: 'SP', zip: '01405-100' },
  { name: 'Tatiana Lopes',    email: 'tatiana.lopes@email.com',    phone: '(61) 99999-1019', birthDate: '1991-12-16T00:00:00.000Z', street: 'SHCN 309 Bloco A',       number: '10',   hood: 'Asa Norte',        city: 'Brasília',       state: 'DF', zip: '70745-500' },
  { name: 'Vinícius Correia', email: 'vinicius.correia@email.com', phone: '(11) 99999-1020', birthDate: '1988-04-05T00:00:00.000Z', street: 'Rua Fradique Coutinho',  number: '780',  hood: 'Vila Madalena',    city: 'São Paulo',      state: 'SP', zip: '05416-011' },
]

const BANNERS = [
  { title: 'Novidades em Vinil – Chegadas da Semana',  subtitle: 'Os lançamentos e relanças que chegaram essa semana',   link: '/records',  linkLabel: 'Ver Discos',      order: 1 },
  { title: 'Raridades em Estoque',                     subtitle: 'Peças únicas para verdadeiros colecionadores',          link: '/records',  linkLabel: 'Ver Raridades',   order: 2 },
  { title: 'Pink Floyd – Coleção Especial',            subtitle: 'Dark Side, The Wall e muito mais em vinil',             link: '/records',  linkLabel: 'Comprar Agora',   order: 3 },
  { title: 'Merchandise Oficial',                      subtitle: 'Camisetas, moletons e patches rock e metal',            link: '/apparel',  linkLabel: 'Ver Produtos',    order: 4 },
  { title: 'Heavy Metal Clássico',                     subtitle: 'Iron Maiden, Black Sabbath, Judas Priest e mais',       link: '/records',  linkLabel: 'Explorar Metal',  order: 5 },
  { title: 'Frete Grátis Acima de R$200',              subtitle: 'Para todo o Brasil',                                    link: '/records',  linkLabel: 'Aproveitar',      order: 6 },
  { title: 'Rock Nacional Anos 80',                    subtitle: 'Legião Urbana, Titãs, Sepultura e muito mais',          link: '/records',  linkLabel: 'Ver Acervo',      order: 7 },
  { title: 'Thrash Metal – Os Quatro Grandes',         subtitle: 'Metallica, Slayer, Megadeth e Anthrax em vinil',        link: '/records',  linkLabel: 'Ver Thrash',      order: 8 },
  { title: 'Liquidação – Até 30% Off',                 subtitle: 'Aproveite enquanto dura!',                              link: '/records',  linkLabel: 'Ver Promoções',   order: 9 },
  { title: 'Beatles Collection',                       subtitle: 'Todos os álbuns em vinil disponíveis',                  link: '/records',  linkLabel: 'Ver Beatles',     order: 10 },
  { title: 'Novos Moletons Chegaram',                  subtitle: 'Conforto e estilo — edições rock e metal',              link: '/apparel',  linkLabel: 'Ver Moletons',    order: 11 },
  { title: 'Rock Internacional – Décadas de Ouro',     subtitle: 'Anos 60, 70, 80 e 90 em vinil',                         link: '/records',  linkLabel: 'Explorar',        order: 12 },
  { title: 'Grunge & Alternative',                     subtitle: 'Nirvana, Radiohead, Soundgarden e mais',                link: '/records',  linkLabel: 'Ver Grunge',      order: 13 },
  { title: 'Box Sets Colecionáveis',                   subtitle: 'Para verdadeiros fãs de rock e metal',                  link: '/records',  linkLabel: 'Ver Box Sets',    order: 14 },
  { title: 'Punk Rock – A Origem da Revolta',          subtitle: 'The Clash, Sex Pistols, Ramones e mais',                link: '/records',  linkLabel: 'Ver Punk',        order: 15 },
]

// ─── runSeed ──────────────────────────────────────────────────────────────────

export async function runSeed(payload: Payload): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}

  // Garante que as credenciais do Cloudinary são carregadas AGORA
  // (o módulo pode ter inicializado antes do dotenv processar o .env)
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  // Diagnóstico: mostra quais vars estão presentes (nunca os valores)
  console.log('→ Cloudinary env vars:', {
    CLOUDINARY_CLOUD_NAME:  process.env.CLOUDINARY_CLOUD_NAME  ? '✓' : '✗ AUSENTE',
    CLOUDINARY_API_KEY:     process.env.CLOUDINARY_API_KEY     ? '✓' : '✗ AUSENTE',
    CLOUDINARY_API_SECRET:  process.env.CLOUDINARY_API_SECRET  ? '✓' : '✗ AUSENTE',
  })

  // Testa a conexão com o Cloudinary ANTES de criar qualquer coisa no banco.
  // Se falhar aqui, nada é criado e não precisa rodar clear.
  console.log('→ Testando conexão com Cloudinary...')
  try {
    const pingBuf = await sharp({
      create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
    }).jpeg().toBuffer()
    await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${pingBuf.toString('base64')}`,
      { folder: 'elessar-records/seed', public_id: '_ping', overwrite: true, resource_type: 'image' },
    )
    console.log('✓ Cloudinary OK')
  } catch (err: unknown) {
    // O SDK do Cloudinary lança objetos simples, não instâncias de Error
    let msg: string
    if (err instanceof Error) {
      msg = err.message
    } else if (err !== null && typeof err === 'object') {
      const o = err as Record<string, unknown>
      const inner = (o.error ?? o) as Record<string, unknown>
      msg = String(inner.message ?? JSON.stringify(inner))
    } else {
      msg = String(err)
    }
    throw new Error(`Cloudinary inacessível: ${msg}\nVerifique CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET no .env`)
  }

  const existing = await payload.find({ collection: 'categories', limit: 1, pagination: false, overrideAccess: true })
  if (existing.totalDocs > 0) {
    throw new Error('Banco não está vazio. Rode npm run clear primeiro.')
  }

  // 1. Gêneros musicais
  const genreIds: Record<string, string | number> = {}
  for (const g of GENRES) {
    const doc = await payload.create({
      collection: 'genres',
      data: { name: g.name, description: g.desc },
      overrideAccess: true,
    })
    genreIds[g.name] = doc.id
  }
  counts.genres = GENRES.length

  // 2. Categorias
  const catIds: Record<string, string | number> = {}
  for (const cat of CATEGORIES) {
    const doc = await payload.create({ collection: 'categories', data: { name: cat.name, description: cat.desc }, overrideAccess: true })
    catIds[cat.name] = doc.id
  }
  counts.categories = CATEGORIES.length

  // 3. Artistas — foto individual por artista (Wikipedia thumbnail, fallback colorido)
  let colorIdx = 0
  const artistIds: Record<string, string | number> = {}
  for (const a of ARTISTS) {
    const thumbUrl = await fetchWikipediaThumb(a.name)
    console.log(`  → ${a.name}: ${thumbUrl ? '✓ Wikipedia' : '○ placeholder'}`)
    const photoId = await createMediaUrl(payload, a.name, colorIdx++, thumbUrl)
    const doc = await payload.create({
      collection: 'artists',
      data: { name: a.name, bio: a.bio, active: true, photo: photoId },
      overrideAccess: true,
    })
    artistIds[a.name] = doc.id
  }
  counts.artists = ARTISTS.length

  // 4. Discos — imagem individual + genre linkado
  type DocRef = { id: string | number; price: number; title: string; sku: string; sizes?: string[] }
  const recordDocs: DocRef[] = []
  for (const rec of RECORDS) {
    const aId = artistIds[rec.artist]
    const gId = genreIds[rec.genre]
    if (!aId) continue
    const thumbUrl = await fetchWikipediaThumb(`${rec.title} (album)`, `${rec.title} (álbum)`, rec.title)
    console.log(`  → ${rec.title}: ${thumbUrl ? '✓ Wikipedia' : '○ placeholder'}`)
    const imgId = await createMediaUrl(payload, rec.title, colorIdx++, thumbUrl)
    const doc = await payload.create({
      collection: 'records',
      data: {
        title: rec.title,
        shortDescription: rec.desc,
        description: richText(`${rec.desc} Gravadora: ${rec.label}. Ano: ${rec.year}.`),
        price: rec.price, stock: rec.stock, sku: rec.sku, format: rec.format, condition: rec.condition,
        ...(rec.situation.length > 0 ? { situation: rec.situation } : {}),
        artist: aId,
        ...(gId ? { genre: gId } : {}),
        releaseYear: rec.year, recordLabel: rec.label,
        featured: ('featured' in rec) ? Boolean(rec.featured) : false,
        isRare: ('isRare' in rec) ? Boolean(rec.isRare) : false,
        active: true, weight: 300,
        images: [{ image: imgId, altText: rec.title }],
      },
      overrideAccess: true,
    })
    recordDocs.push({ id: doc.id, price: rec.price, title: rec.title, sku: rec.sku })
  }
  counts.records = recordDocs.length

  // 5. Vestuário — imagem individual por peça
  const apparelDocs: DocRef[] = []
  for (const app of APPAREL) {
    const cId = catIds[app.cat]
    const aId = app.artist ? artistIds[app.artist] : undefined
    if (!cId) continue
    const imgId = await createMedia(payload, app.title, colorIdx++)
    const doc = await payload.create({
      collection: 'apparel',
      data: {
        title: app.title,
        shortDescription: app.desc,
        description: richText(`${app.desc} Tipo: ${app.type}. Estado: ${app.condition}.`),
        price: app.price, sku: app.sku, apparelType: app.type, condition: app.condition, category: cId,
        ...(aId ? { artist: aId } : {}),
        variants: app.sizes.map((size) => ({ size, color: 'Preto', stock: 5 })),
        featured: ('featured' in app) ? Boolean(app.featured) : false,
        active: true, weight: 200,
        images: [{ image: imgId, altText: app.title }],
      },
      overrideAccess: true,
    })
    apparelDocs.push({ id: doc.id, price: app.price, title: app.title, sku: app.sku, sizes: app.sizes })
  }
  counts.apparel = apparelDocs.length

  // 6. Clientes
  const customerIds: (string | number)[] = []
  for (const c of CUSTOMERS) {
    const doc = await payload.create({
      collection: 'users',
      data: {
        name: c.name, email: c.email, phone: c.phone, birthDate: c.birthDate,
        role: 'client',
        password: 'Seed@123456',
        _verified: true,
        addresses: [{ label: 'Casa', street: c.street, number: c.number, neighborhood: c.hood, city: c.city, state: c.state, zipCode: c.zip, isDefault: true }],
      },
      overrideAccess: true,
    })
    customerIds.push(doc.id)
  }
  counts.users = customerIds.length

  // 7. Pedidos
  const STATUSES = ['aguardando_pagamento', 'pago', 'etiqueta_criada', 'enviado', 'entregue', 'cancelado']
  const PAY_METHODS = ['pix', 'credit_card', 'boleto']
  for (let i = 0; i < 15; i++) {
    const cust = CUSTOMERS[i % CUSTOMERS.length]!
    const rec  = recordDocs[i % recordDocs.length]!
    const app  = apparelDocs[i % apparelDocs.length]!
    const items: Record<string, unknown>[] = [
      { product: { value: rec.id, relationTo: 'records' }, quantity: 1, unitPrice: rec.price, productTitle: rec.title, productSku: rec.sku },
    ]
    if (i % 2 === 1) {
      items.push({ product: { value: app.id, relationTo: 'apparel' }, quantity: 1, variantSize: (app.sizes ?? ['M'])[0] ?? 'M', unitPrice: app.price, productTitle: app.title, productSku: app.sku })
    }
    await payload.create({
      collection: 'orders',
      data: {
        orderNumber: `ER-SEED-${String(i + 1).padStart(3, '0')}`,
        customer: customerIds[i % customerIds.length]!,
        items, discount: i % 5 === 0 ? 500 : 0,
        status: STATUSES[i % STATUSES.length], paymentMethod: PAY_METHODS[i % PAY_METHODS.length], paymentStatus: 'unpaid',
        // shipping é derivado de freteEscolhido.preco no beforeValidate.
        freteEscolhido: { servicoId: 1, transportadora: 'Correios', nome: 'PAC', prazo: 5, preco: 1500 },
        destinatario: {
          nome: cust.name, cpf: '529.982.247-25', email: cust.email, telefone: cust.phone,
          cep: cust.zip, rua: cust.street, numero: cust.number, complemento: '',
          bairro: cust.hood, cidade: cust.city, uf: cust.state,
        },
        notes: 'Pedido criado via seed.',
      },
      overrideAccess: true,
      // Evita 15 chamadas externas à SuperFrete durante o seed.
      context: { skipValidacaoFrete: true },
    })
  }
  counts.orders = 15

  // 8. Banners — imagem individual por banner
  for (const b of BANNERS) {
    const imgId = await createMedia(payload, b.title, colorIdx++)
    await payload.create({
      collection: 'banners',
      data: { title: b.title, subtitle: b.subtitle, image: imgId, link: b.link, linkLabel: b.linkLabel, active: true, order: b.order },
      overrideAccess: true,
    })
  }
  counts.banners = BANNERS.length

  counts.media = colorIdx
  return counts
}

// ─── runClear ─────────────────────────────────────────────────────────────────

export async function runClear(payload: Payload): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}

  // Ordem importa: deletar dependentes antes dos referenciados (FK constraints)
  const slugs: CollectionSlug[] = [
    'orders',
    'banners',
    'records',   // records → genres (FK), então genres vem depois
    'apparel',
    'users',
    'artists',
    'genres',    // só depois que records foram deletados
    'categories',
    'media',
  ]

  for (const slug of slugs) {
    const where = slug === 'users' ? { role: { not_equals: 'admin' } } : {}
    const { docs } = await payload.find({ collection: slug, where, limit: 9999, depth: 0, overrideAccess: true })
    for (const doc of docs) {
      await payload.delete({ collection: slug, id: doc.id, overrideAccess: true })
    }
    counts[slug] = docs.length
  }

  return counts
}
