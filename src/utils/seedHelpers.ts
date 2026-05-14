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
  { name: 'Rock',             desc: 'O gênero que definiu gerações.' },
  { name: 'Rock Nacional',    desc: 'Rock brasileiro em toda sua força e potência.' },
  { name: 'Hard Rock',        desc: 'Rock pesado, poderoso e com riffs icônicos.' },
  { name: 'Heavy Metal',      desc: 'Metal clássico com distorção máxima.' },
  { name: 'Power Metal',      desc: 'Metal épico, veloz e com vocais potentes.' },
  { name: 'Death Metal',      desc: 'Metal extremo, riffs rápidos e vocais guturais.' },
  { name: 'Doom Metal',       desc: 'Metal lento, sombrio e denso.' },
  { name: 'Rock Progressivo', desc: 'Rock experimental e instrumentalmente elaborado.' },
  { name: 'Glam Rock',        desc: 'Rock teatral e extravagante dos anos 70.' },
  { name: 'Grunge',           desc: 'O som cru e angustiado de Seattle nos anos 90.' },
  { name: 'Punk Rock',        desc: 'Velocidade, atitude e rebeldia pura.' },
  { name: 'New Wave',         desc: 'Pós-punk e pop eletrônico dos anos 80.' },
  { name: 'Alternative Rock', desc: 'Rock fora do mainstream comercial.' },
  { name: 'Indie Rock',       desc: 'Rock independente e autoral.' },
  { name: 'Pop Rock',         desc: 'A fusão acessível do rock com o pop.' },
  { name: 'Soft Rock',        desc: 'Rock melódico, suave e emocional.' },
  { name: 'Pop',              desc: 'Músicas catchy e acessíveis para todos.' },
  { name: 'MPB',              desc: 'Música Popular Brasileira em toda sua riqueza.' },
  { name: 'Tropicalismo',     desc: 'O movimento que revolucionou a música brasileira nos anos 60.' },
  { name: 'Psicodélico',      desc: 'Som expansivo, experimental e lisérgico.' },
  { name: 'Jazz',             desc: 'Improviso, complexidade harmônica e elegância.' },
  { name: 'Jazz Fusion',      desc: 'Jazz mesclado com rock, funk e música eletrônica.' },
  { name: 'Blues',            desc: 'A raiz de toda música moderna ocidental.' },
  { name: 'Soul',             desc: 'Emoção, groove e herança afro-americana.' },
  { name: 'Funk',             desc: 'Ritmo, baixo pesado e dança.' },
  { name: 'Reggae',           desc: 'Jamaica, paz, resistência e roots.' },
  { name: 'Ska',              desc: 'O precursor jamaicano do reggae.' },
  { name: 'Bossa Nova',       desc: 'Samba, jazz e a sofisticação carioca.' },
  { name: 'Samba',            desc: 'O ritmo que define a identidade do Brasil.' },
]

const CATEGORIES = [
  { name: 'Rock Nacional',       desc: 'O melhor do rock brasileiro, de Legião Urbana a Sepultura.' },
  { name: 'Rock Internacional',  desc: 'Clássicos do rock mundial, dos anos 60 ao presente.' },
  { name: 'Jazz',                desc: 'Jazz americano e fusion, do bebop ao contemporâneo.' },
  { name: 'Blues',               desc: 'Blues raiz e elétrico, Chicago e Delta Blues.' },
  { name: 'MPB',                 desc: 'Música Popular Brasileira: Caetano, Gil, Chico e outros.' },
  { name: 'Samba',               desc: 'Samba de raiz, pagode e samba enredo.' },
  { name: 'Bossa Nova',          desc: 'A sofisticação da Bossa Nova brasileira.' },
  { name: 'Heavy Metal',         desc: 'Metal pesado nacional e internacional.' },
  { name: 'Punk Rock',           desc: 'Punk, hardcore e new wave.' },
  { name: 'Hip-Hop',             desc: 'Hip-hop nacional e internacional.' },
  { name: 'Eletrônica',          desc: 'Techno, house, ambient e música eletrônica.' },
  { name: 'Reggae',              desc: 'Reggae, dancehall e dub.' },
  { name: 'Soul & Funk',         desc: 'Soul, funk e R&B.' },
  { name: 'Clássico',            desc: 'Música erudita e clássica.' },
  { name: 'Indie & Alternativo', desc: 'Indie rock, post-rock e alternativo.' },
  { name: 'Pop',                 desc: 'Pop nacional e internacional.' },
  { name: 'Forró',               desc: 'Forró pé-de-serra e universitário.' },
  { name: 'Axé',                 desc: 'Axé music baiana.' },
  { name: 'Sertanejo',           desc: 'Sertanejo universitário e raiz.' },
  { name: 'Merchandise',         desc: 'Camisetas, bonés, pôsteres e acessórios.' },
]

const ARTISTS = [
  { name: 'Legião Urbana',      bio: 'Banda de rock brasiliense liderada por Renato Russo.' },
  { name: 'Cazuza',             bio: 'Poeta e cantor carioca, ícone do Barão Vermelho.' },
  { name: 'Raul Seixas',        bio: 'O Maluco Beleza do rock brasileiro.' },
  { name: 'Titãs',              bio: 'Banda paulistana fundamental do rock dos anos 80.' },
  { name: 'Os Mutantes',        bio: 'Pioneiros do rock psicodélico brasileiro.' },
  { name: 'Caetano Veloso',     bio: 'Um dos maiores nomes da MPB e fundador do Tropicalismo.' },
  { name: 'Gilberto Gil',       bio: 'Cantor e compositor baiano, ícone da MPB.' },
  { name: 'Chico Buarque',      bio: 'Compositor, dramaturgo e romancista da MPB.' },
  { name: 'Tim Maia',           bio: 'O Síndico do Soul, pioneiro do soul e funk no Brasil.' },
  { name: 'Roberto Carlos',     bio: 'O Rei da jovem guarda e do romantismo brasileiro.' },
  { name: 'The Beatles',        bio: 'A banda mais influente da história da música popular.' },
  { name: 'Led Zeppelin',       bio: 'Pioneiros do hard rock e heavy metal, formados em 1968.' },
  { name: 'Pink Floyd',         bio: 'Banda britânica de rock progressivo e psicodélico.' },
  { name: 'The Rolling Stones', bio: 'The Greatest Rock and Roll Band in the World.' },
  { name: 'David Bowie',        bio: 'O Camaleão do Rock, mestre da reinvenção artística.' },
  { name: 'Nirvana',            bio: 'Trio de Seattle que redefiniu o rock com o grunge.' },
  { name: 'Radiohead',          bio: 'Banda britânica de rock alternativo e experimental.' },
  { name: 'The Clash',          bio: 'Pioneiros do punk rock britânico e da world music.' },
  { name: 'Bob Marley',         bio: 'O embaixador do reggae jamaicano para o mundo.' },
  { name: 'Miles Davis',        bio: 'Trompetista americano que revolucionou o jazz.' },
]

const RECORDS = [
  { title: 'Que País É Este',                     artist: 'Legião Urbana',      genre: 'Rock Nacional',    format: 'vinyl', condition: 'used', situation: [],                               year: 1987, label: 'EMI',                 price: 8990,  stock: 5,  sku: 'REC-001', desc: 'Álbum marcante da fase madura da Legião Urbana.',           featured: true },
  { title: 'O Tempo Não Pára',                    artist: 'Cazuza',             genre: 'Rock Nacional',    format: 'vinyl', condition: 'used', situation: ['collectible'],                   year: 1988, label: 'PolyGram',            price: 12990, stock: 3,  sku: 'REC-002', desc: 'Clássico de Cazuza com letras poéticas e viscerais.' },
  { title: 'Krig-ha, Bandolo!',                   artist: 'Raul Seixas',        genre: 'Rock Nacional',    format: 'vinyl', condition: 'used', situation: ['rare'],                          year: 1973, label: 'Philips',             price: 24990, stock: 2,  sku: 'REC-003', desc: 'O álbum de estreia solo do Maluco Beleza.',                 isRare: true },
  { title: 'Cabeça Dinossauro',                   artist: 'Titãs',              genre: 'Punk Rock',        format: 'vinyl', condition: 'used', situation: [],                               year: 1986, label: 'WEA',                 price: 9990,  stock: 4,  sku: 'REC-004', desc: 'O álbum mais pesado e político dos Titãs.' },
  { title: 'Os Mutantes',                         artist: 'Os Mutantes',        genre: 'Psicodélico',      format: 'vinyl', condition: 'used', situation: ['collectible', 'rare'],           year: 1968, label: 'Polydor',             price: 34990, stock: 1,  sku: 'REC-005', desc: 'Álbum de estreia psicodélico, marco do Tropicalismo.',      isRare: true },
  { title: 'Tropicália ou Panis et Circencis',    artist: 'Caetano Veloso',     genre: 'Tropicalismo',     format: 'vinyl', condition: 'used', situation: ['collectible'],                   year: 1968, label: 'Philips',             price: 29990, stock: 2,  sku: 'REC-006', desc: 'O manifesto do Tropicalismo em forma de disco.',            featured: true },
  { title: 'Expresso 2222',                       artist: 'Gilberto Gil',       genre: 'MPB',              format: 'vinyl', condition: 'used', situation: [],                               year: 1972, label: 'Philips',             price: 14990, stock: 5,  sku: 'REC-007', desc: 'Disco fundamental de Gilberto Gil.' },
  { title: 'Construção',                          artist: 'Chico Buarque',      genre: 'MPB',              format: 'vinyl', condition: 'used', situation: ['collectible'],                   year: 1971, label: 'Philips',             price: 19990, stock: 3,  sku: 'REC-008', desc: 'Obra-prima de Chico Buarque com letras magistrais.',        featured: true },
  { title: 'Tim Maia',                            artist: 'Tim Maia',           genre: 'Soul',             format: 'vinyl', condition: 'used', situation: [],                               year: 1970, label: 'Polydor',             price: 13990, stock: 4,  sku: 'REC-009', desc: 'O álbum de estreia do Síndico do Soul brasileiro.' },
  { title: 'Abbey Road',                          artist: 'The Beatles',        genre: 'Rock',             format: 'vinyl', condition: 'new',  situation: ['remastered'],                   year: 1969, label: 'Apple',               price: 19990, stock: 10, sku: 'REC-010', desc: 'O penúltimo álbum dos Beatles, um clássico absoluto.' },
  { title: 'Led Zeppelin IV',                     artist: 'Led Zeppelin',       genre: 'Hard Rock',        format: 'vinyl', condition: 'used', situation: ['collectible'],                   year: 1971, label: 'Atlantic',            price: 27990, stock: 3,  sku: 'REC-011', desc: 'Stairway to Heaven. O resto é história.' },
  { title: 'The Dark Side of the Moon',           artist: 'Pink Floyd',         genre: 'Rock Progressivo', format: 'vinyl', condition: 'used', situation: ['imported'],                      year: 1973, label: 'Harvest',             price: 32990, stock: 5,  sku: 'REC-012', desc: 'O disco mais vendido da história do rock.',                 featured: true },
  { title: 'Sticky Fingers',                      artist: 'The Rolling Stones', genre: 'Rock',             format: 'vinyl', condition: 'used', situation: [],                               year: 1971, label: 'Rolling Stones Rec.', price: 11990, stock: 6,  sku: 'REC-013', desc: 'Com a famosa capa de Andy Warhol.' },
  { title: 'The Rise and Fall of Ziggy Stardust', artist: 'David Bowie',        genre: 'Glam Rock',        format: 'vinyl', condition: 'used', situation: ['collectible', 'limited_edition'], year: 1972, label: 'RCA',                 price: 24990, stock: 3,  sku: 'REC-014', desc: 'A obra-prima glam rock de David Bowie.' },
  { title: 'Nevermind',                           artist: 'Nirvana',            genre: 'Grunge',           format: 'vinyl', condition: 'used', situation: [],                               year: 1991, label: 'DGC',                 price: 14990, stock: 7,  sku: 'REC-015', desc: 'O disco que mudou o rock nos anos 90.' },
  { title: 'OK Computer',                         artist: 'Radiohead',          genre: 'Alternative Rock', format: 'cd',    condition: 'new',  situation: ['remastered'],                   year: 1997, label: 'Parlophone',          price: 7990,  stock: 12, sku: 'REC-016', desc: 'Uma meditação sobre a era digital e a alienação.' },
  { title: 'London Calling',                      artist: 'The Clash',          genre: 'Punk Rock',        format: 'vinyl', condition: 'used', situation: ['imported'],                      year: 1979, label: 'CBS',                 price: 18990, stock: 4,  sku: 'REC-017', desc: 'O álbum definitivo do punk rock britânico.' },
  { title: 'Legend: The Best of Bob Marley',      artist: 'Bob Marley',         genre: 'Reggae',           format: 'cd',    condition: 'new',  situation: [],                               year: 1984, label: 'Island',              price: 6990,  stock: 15, sku: 'REC-018', desc: 'A coletânea essencial de Bob Marley.' },
  { title: 'Kind of Blue',                        artist: 'Miles Davis',        genre: 'Jazz',             format: 'vinyl', condition: 'used', situation: ['collectible', 'rare'],           year: 1959, label: 'Columbia',            price: 34990, stock: 2,  sku: 'REC-019', desc: 'O álbum de jazz mais vendido de todos os tempos.',          isRare: true },
  { title: 'Bitches Brew',                        artist: 'Miles Davis',        genre: 'Jazz Fusion',      format: 'vinyl', condition: 'used', situation: ['rare', 'collectible'],           year: 1970, label: 'Columbia',            price: 44990, stock: 1,  sku: 'REC-020', desc: 'A obra que fundou o jazz fusion.',                          isRare: true },
]

const APPAREL = [
  { title: 'Camiseta Legião Urbana – Que País É Este', type: 'tshirt',  condition: 'new', price: 8990,  sku: 'APP-001', cat: 'Merchandise', artist: 'Legião Urbana',      desc: 'Camiseta com estampa do álbum Que País É Este.', sizes: ['P','M','G','GG'] },
  { title: 'Camiseta Pink Floyd – Dark Side',           type: 'tshirt',  condition: 'new', price: 9990,  sku: 'APP-002', cat: 'Merchandise', artist: 'Pink Floyd',          desc: 'Camiseta com o icônico prisma do Dark Side.',     sizes: ['PP','P','M','G','GG'] },
  { title: 'Moletom Nirvana – Nevermind',               type: 'hoodie',  condition: 'new', price: 17990, sku: 'APP-003', cat: 'Merchandise', artist: 'Nirvana',             desc: 'Moletom com estampa clássica do Nevermind.',      sizes: ['P','M','G','GG','GGG'] },
  { title: 'Boné Rolling Stones – Língua',              type: 'cap',     condition: 'new', price: 5990,  sku: 'APP-004', cat: 'Merchandise', artist: 'The Rolling Stones',  desc: 'Boné com o logo clássico dos Rolling Stones.',    sizes: ['unico'] },
  { title: 'Pôster The Beatles – Abbey Road',           type: 'poster',  condition: 'new', price: 3990,  sku: 'APP-005', cat: 'Merchandise', artist: 'The Beatles',         desc: 'Pôster da icônica capa do Abbey Road.',           sizes: ['unico'] },
  { title: 'Camiseta David Bowie – Ziggy',              type: 'tshirt',  condition: 'new', price: 8990,  sku: 'APP-006', cat: 'Merchandise', artist: 'David Bowie',         desc: 'Camiseta com o relâmpago de Ziggy Stardust.',     sizes: ['P','M','G','GG'] },
  { title: 'Patch Led Zeppelin',                        type: 'patch',   condition: 'new', price: 1990,  sku: 'APP-007', cat: 'Merchandise', artist: 'Led Zeppelin',        desc: 'Patch bordado com símbolo de Led Zeppelin.',      sizes: ['unico'] },
  { title: 'Camiseta Tropicália',                       type: 'tshirt',  condition: 'new', price: 8990,  sku: 'APP-008', cat: 'Merchandise', artist: 'Caetano Veloso',      desc: 'Camiseta comemorativa do movimento Tropicalista.', sizes: ['P','M','G','GG'] },
  { title: 'Moletom Radiohead – OK Computer',           type: 'hoodie',  condition: 'new', price: 16990, sku: 'APP-009', cat: 'Merchandise', artist: 'Radiohead',           desc: 'Moletom com arte do OK Computer.',                sizes: ['P','M','G','GG'] },
  { title: 'Jaqueta Elessar Records – Clássica',        type: 'jacket',  condition: 'new', price: 24990, sku: 'APP-010', cat: 'Merchandise', artist: null,                  desc: 'Jaqueta oficial com logo bordado.',               sizes: ['P','M','G','GG'], featured: true },
  { title: 'Pôster Bob Marley – Legend',                type: 'poster',  condition: 'new', price: 2990,  sku: 'APP-011', cat: 'Merchandise', artist: 'Bob Marley',          desc: 'Pôster de Bob Marley em alta resolução.',         sizes: ['unico'] },
  { title: 'Camiseta Os Mutantes',                      type: 'tshirt',  condition: 'new', price: 7990,  sku: 'APP-012', cat: 'Merchandise', artist: 'Os Mutantes',         desc: 'Camiseta psicodélica dos Mutantes.',              sizes: ['P','M','G','GG','GGG'] },
  { title: 'Boné Elessar Records',                      type: 'cap',     condition: 'new', price: 4990,  sku: 'APP-013', cat: 'Merchandise', artist: null,                  desc: 'Boné bordado com logo da Elessar Records.',       sizes: ['unico'] },
  { title: 'Camiseta The Clash – London Calling',       type: 'tshirt',  condition: 'new', price: 8990,  sku: 'APP-014', cat: 'Merchandise', artist: 'The Clash',           desc: 'Camiseta com arte da capa de London Calling.',    sizes: ['P','M','G','GG'] },
  { title: 'Patch Elessar Records',                     type: 'patch',   condition: 'new', price: 1990,  sku: 'APP-015', cat: 'Merchandise', artist: null,                  desc: 'Patch bordado com o logo da Elessar Records.',    sizes: ['unico'] },
]

const CUSTOMERS = [
  { name: 'Ana Lima',         email: 'ana.lima@email.com',         phone: '(11) 99999-1001', street: 'Rua Augusta',           number: '123',  hood: 'Consolação',       city: 'São Paulo',      state: 'SP', zip: '01305-100' },
  { name: 'Bruno Ferreira',   email: 'bruno.ferreira@email.com',   phone: '(11) 99999-1002', street: 'Av. Paulista',           number: '1000', hood: 'Bela Vista',       city: 'São Paulo',      state: 'SP', zip: '01310-100' },
  { name: 'Carolina Santos',  email: 'carolina.santos@email.com',  phone: '(21) 99999-1003', street: 'Rua do Catete',          number: '45',   hood: 'Catete',           city: 'Rio de Janeiro', state: 'RJ', zip: '22220-010' },
  { name: 'Diego Oliveira',   email: 'diego.oliveira@email.com',   phone: '(31) 99999-1004', street: 'Av. Afonso Pena',        number: '500',  hood: 'Centro',           city: 'Belo Horizonte', state: 'MG', zip: '30130-000' },
  { name: 'Elisa Rodrigues',  email: 'elisa.rodrigues@email.com',  phone: '(11) 99999-1005', street: 'Rua Oscar Freire',       number: '789',  hood: 'Jardins',          city: 'São Paulo',      state: 'SP', zip: '01426-001' },
  { name: 'Felipe Costa',     email: 'felipe.costa@email.com',     phone: '(41) 99999-1006', street: 'Rua XV de Novembro',     number: '200',  hood: 'Centro',           city: 'Curitiba',       state: 'PR', zip: '80020-310' },
  { name: 'Gabriela Alves',   email: 'gabriela.alves@email.com',   phone: '(51) 99999-1007', street: 'Rua dos Andradas',       number: '1080', hood: 'Centro Histórico', city: 'Porto Alegre',   state: 'RS', zip: '90020-010' },
  { name: 'Henrique Mendes',  email: 'henrique.mendes@email.com',  phone: '(11) 99999-1008', street: 'Rua da Consolação',      number: '234',  hood: 'Consolação',       city: 'São Paulo',      state: 'SP', zip: '01301-000' },
  { name: 'Isabela Pereira',  email: 'isabela.pereira@email.com',  phone: '(21) 99999-1009', street: 'Av. Atlântica',          number: '1702', hood: 'Copacabana',       city: 'Rio de Janeiro', state: 'RJ', zip: '22021-001' },
  { name: 'João Nascimento',  email: 'joao.nascimento@email.com',  phone: '(85) 99999-1010', street: 'Rua Senador Pompeu',     number: '300',  hood: 'Centro',           city: 'Fortaleza',      state: 'CE', zip: '60025-080' },
  { name: 'Karina Barbosa',   email: 'karina.barbosa@email.com',   phone: '(11) 99999-1011', street: 'Av. Brasil',             number: '456',  hood: 'Pinheiros',        city: 'São Paulo',      state: 'SP', zip: '05409-000' },
  { name: 'Lucas Carvalho',   email: 'lucas.carvalho@email.com',   phone: '(71) 99999-1012', street: 'Av. Sete de Setembro',   number: '100',  hood: 'Centro',           city: 'Salvador',       state: 'BA', zip: '40060-001' },
  { name: 'Mariana Gomes',    email: 'mariana.gomes@email.com',    phone: '(11) 99999-1013', street: 'Rua Haddock Lobo',       number: '595',  hood: 'Cerqueira César',  city: 'São Paulo',      state: 'SP', zip: '01414-001' },
  { name: 'Nelson Araújo',    email: 'nelson.araujo@email.com',    phone: '(27) 99999-1014', street: 'Av. N. Sra. da Penha',   number: '1600', hood: 'Santa Lúcia',      city: 'Vitória',        state: 'ES', zip: '29045-402' },
  { name: 'Olivia Martins',   email: 'olivia.martins@email.com',   phone: '(62) 99999-1015', street: 'Av. Goiás',              number: '300',  hood: 'Centro',           city: 'Goiânia',        state: 'GO', zip: '74015-015' },
  { name: 'Pedro Sousa',      email: 'pedro.sousa@email.com',      phone: '(11) 99999-1016', street: 'Rua Vergueiro',          number: '1000', hood: 'Vila Mariana',     city: 'São Paulo',      state: 'SP', zip: '04101-000' },
  { name: 'Renata Vieira',    email: 'renata.vieira@email.com',    phone: '(92) 99999-1017', street: 'Av. Eduardo Ribeiro',    number: '520',  hood: 'Centro',           city: 'Manaus',         state: 'AM', zip: '69010-001' },
  { name: 'Samuel Castro',    email: 'samuel.castro@email.com',    phone: '(11) 99999-1018', street: 'Rua Pamplona',           number: '145',  hood: 'Jardim Paulista',  city: 'São Paulo',      state: 'SP', zip: '01405-100' },
  { name: 'Tatiana Lopes',    email: 'tatiana.lopes@email.com',    phone: '(61) 99999-1019', street: 'SHCN 309 Bloco A',       number: '10',   hood: 'Asa Norte',        city: 'Brasília',       state: 'DF', zip: '70745-500' },
  { name: 'Vinícius Correia', email: 'vinicius.correia@email.com', phone: '(11) 99999-1020', street: 'Rua Fradique Coutinho',  number: '780',  hood: 'Vila Madalena',    city: 'São Paulo',      state: 'SP', zip: '05416-011' },
]

const BANNERS = [
  { title: 'Novidades em Vinil – Chegadas da Semana', subtitle: 'Confira os novos vinis da semana',         link: '/records',  linkLabel: 'Ver Discos',    order: 1 },
  { title: 'Clássicos Raros em Estoque',              subtitle: 'Peças únicas para colecionadores',         link: '/records',  linkLabel: 'Ver Raridades', order: 2 },
  { title: 'Pink Floyd – Coleção Especial',           subtitle: 'Toda a discografia disponível',            link: '/records',  linkLabel: 'Comprar Agora', order: 3 },
  { title: 'Merchandise Oficial',                     subtitle: 'Camisetas, moletons e acessórios',         link: '/apparel',  linkLabel: 'Ver Produtos',  order: 4 },
  { title: 'MPB Essencial',                           subtitle: 'Os grandes clássicos da MPB',              link: '/records',  linkLabel: 'Explorar MPB',  order: 5 },
  { title: 'Frete Grátis Acima de R$200',             subtitle: 'Para todo o Brasil',                       link: '/records',  linkLabel: 'Aproveitar',    order: 6 },
  { title: 'Rock Nacional Anos 80',                   subtitle: 'Legião, Titãs, Cazuza e muito mais',       link: '/records',  linkLabel: 'Ver Acervo',    order: 7 },
  { title: 'Jazz e Blues em Vinil',                   subtitle: 'Seleção especial para amantes do jazz',    link: '/records',  linkLabel: 'Ver Jazz',      order: 8 },
  { title: 'Liquidação de Verão – Até 30% Off',       subtitle: 'Aproveite enquanto dura!',                 link: '/records',  linkLabel: 'Ver Promoções', order: 9 },
  { title: 'Beatles Collection',                      subtitle: 'Todos os álbuns em vinil disponíveis',     link: '/records',  linkLabel: 'Ver Beatles',   order: 10 },
  { title: 'Novos Moletons Chegaram',                 subtitle: 'Conforto e estilo para o inverno',         link: '/apparel',  linkLabel: 'Ver Moletons',  order: 11 },
  { title: 'Rock Internacional – Décadas de Ouro',    subtitle: 'Anos 60, 70, 80 e 90',                     link: '/records',  linkLabel: 'Explorar',      order: 12 },
  { title: 'Presente para Quem Ama Música',           subtitle: 'Gift cards e kits especiais',              link: '/records',  linkLabel: 'Ver Presentes', order: 13 },
  { title: 'Box Sets Colecionáveis',                  subtitle: 'Para verdadeiros colecionadores',          link: '/records',  linkLabel: 'Ver Box Sets',  order: 14 },
  { title: 'Novidades em CDs',                        subtitle: 'A melhor seleção para seu acervo',         link: '/records',  linkLabel: 'Ver CDs',       order: 15 },
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

  // 3. Artistas — foto individual por artista
  let colorIdx = 0
  const artistIds: Record<string, string | number> = {}
  for (const a of ARTISTS) {
    const photoId = await createMedia(payload, a.name, colorIdx++)
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
    const imgId = await createMedia(payload, rec.title, colorIdx++)
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
      collection: 'customers',
      data: {
        name: c.name, email: c.email, phone: c.phone,
        addresses: [{ label: 'Casa', street: c.street, number: c.number, neighborhood: c.hood, city: c.city, state: c.state, zipCode: c.zip, isDefault: true }],
      },
      overrideAccess: true,
    })
    customerIds.push(doc.id)
  }
  counts.customers = customerIds.length

  // 7. Pedidos
  const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
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
        items, shipping: 1500, discount: i % 5 === 0 ? 500 : 0,
        status: STATUSES[i % STATUSES.length], paymentMethod: PAY_METHODS[i % PAY_METHODS.length], paymentStatus: 'unpaid',
        shippingAddress: { street: cust.street, number: cust.number, neighborhood: cust.hood, city: cust.city, state: cust.state, zipCode: cust.zip },
        notes: 'Pedido criado via seed.',
      },
      overrideAccess: true,
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
    'customers',
    'artists',
    'genres',    // só depois que records foram deletados
    'categories',
    'media',
  ]

  for (const slug of slugs) {
    const { docs } = await payload.find({ collection: slug, limit: 9999, depth: 0, overrideAccess: true })
    for (const doc of docs) {
      await payload.delete({ collection: slug, id: doc.id, overrideAccess: true })
    }
    counts[slug] = docs.length
  }

  return counts
}
