export interface BibleBookInfo {
  name: string;
  chapters: number;
  aliases: string[];
}

export const BIBLE_BOOKS: BibleBookInfo[] = [
  // Antigo Testamento
  { name: 'Gênesis', chapters: 50, aliases: ['genesis', 'gen', 'gn', 'ge'] },
  { name: 'Êxodo', chapters: 40, aliases: ['exodo', 'ex', 'exo'] },
  { name: 'Levítico', chapters: 27, aliases: ['levitico', 'lv', 'lev'] },
  { name: 'Números', chapters: 36, aliases: ['numeros', 'nm', 'num'] },
  { name: 'Deuteronômio', chapters: 34, aliases: ['deuteronomio', 'dt', 'deu'] },
  { name: 'Josué', chapters: 24, aliases: ['josue', 'js', 'jos'] },
  { name: 'Juízes', chapters: 21, aliases: ['juizes', 'jz', 'jui'] },
  { name: 'Rute', chapters: 4, aliases: ['rute', 'rt', 'rut'] },
  { name: '1 Samuel', chapters: 31, aliases: ['1 samuel', '1samuel', '1 sm', '1sm', '1 sam'] },
  { name: '2 Samuel', chapters: 24, aliases: ['2 samuel', '2samuel', '2 sm', '2sm', '2 sam'] },
  { name: '1 Reis', chapters: 22, aliases: ['1 reis', '1reis', '1 rs', '1rs', '1 re'] },
  { name: '2 Reis', chapters: 25, aliases: ['2 reis', '2reis', '2 rs', '2rs', '2 re'] },
  { name: '1 Crônicas', chapters: 29, aliases: ['1 cronicas', '1cronicas', '1 cr', '1cr', '1 cro'] },
  { name: '2 Crônicas', chapters: 36, aliases: ['2 cronicas', '2cronicas', '2 cr', '2cr', '2 cro'] },
  { name: 'Esdras', chapters: 10, aliases: ['esdras', 'ed', 'esd'] },
  { name: 'Neemias', chapters: 13, aliases: ['neemias', 'ne', 'nee'] },
  { name: 'Ester', chapters: 10, aliases: ['ester', 'et', 'est'] },
  { name: 'Jó', chapters: 42, aliases: ['jo', 'job'] },
  { name: 'Salmos', chapters: 150, aliases: ['salmos', 'salmo', 'sl', 'psalms'] },
  { name: 'Provérbios', chapters: 31, aliases: ['proverbios', 'proverbio', 'pv', 'prv'] },
  { name: 'Eclesiastes', chapters: 12, aliases: ['eclesiastes', 'ec', 'ecl'] },
  { name: 'Cantares', chapters: 8, aliases: ['cantares', 'cantares de salomao', 'ct', 'cant'] },
  { name: 'Isaías', chapters: 66, aliases: ['isaias', 'is', 'isa'] },
  { name: 'Jeremias', chapters: 52, aliases: ['jeremias', 'jr', 'jer'] },
  { name: 'Lamentações', chapters: 5, aliases: ['lamentacoes', 'lm', 'lam'] },
  { name: 'Ezequiel', chapters: 48, aliases: ['ezequiel', 'ez', 'eze'] },
  { name: 'Daniel', chapters: 12, aliases: ['daniel', 'dn', 'dan'] },
  { name: 'Oséias', chapters: 14, aliases: ['oseias', 'os', 'ose'] },
  { name: 'Joel', chapters: 3, aliases: ['joel', 'jl', 'joe'] },
  { name: 'Amós', chapters: 9, aliases: ['amos', 'am', 'amo'] },
  { name: 'Obadias', chapters: 1, aliases: ['obadias', 'ob', 'oba'] },
  { name: 'Jonas', chapters: 4, aliases: ['jonas', 'jn', 'jon'] },
  { name: 'Miquéias', chapters: 7, aliases: ['miqueias', 'mq', 'miq'] },
  { name: 'Naum', chapters: 3, aliases: ['naum', 'na', 'nau'] },
  { name: 'Habacuque', chapters: 3, aliases: ['habacuque', 'hc', 'hab'] },
  { name: 'Sofonias', chapters: 3, aliases: ['sofonias', 'sf', 'sof'] },
  { name: 'Ageu', chapters: 2, aliases: ['ageu', 'ag', 'age'] },
  { name: 'Zacarias', chapters: 14, aliases: ['zacarias', 'zc', 'zac'] },
  { name: 'Malaquias', chapters: 4, aliases: ['malaquias', 'ml', 'mal'] },

  // Novo Testamento
  { name: 'Mateus', chapters: 28, aliases: ['mateus', 'mt', 'mat'] },
  { name: 'Marcos', chapters: 16, aliases: ['marcos', 'mc', 'mar'] },
  { name: 'Lucas', chapters: 24, aliases: ['lucas', 'lc', 'luc'] },
  { name: 'João', chapters: 21, aliases: ['joao', 'jo', 'jhn'] },
  { name: 'Atos', chapters: 28, aliases: ['atos', 'at', 'act'] },
  { name: 'Romanos', chapters: 16, aliases: ['romanos', 'rm', 'rom'] },
  { name: '1 Coríntios', chapters: 16, aliases: ['1 corintios', '1corintios', '1 co', '1co', '1 cor'] },
  { name: '2 Coríntios', chapters: 23, aliases: ['2 corintios', '2corintios', '2 co', '2co', '2 cor'] },
  { name: 'Gálatas', chapters: 6, aliases: ['galatas', 'gl', 'gal'] },
  { name: 'Efésios', chapters: 6, aliases: ['efesios', 'ef', 'efe'] },
  { name: 'Filipenses', chapters: 4, aliases: ['filipenses', 'fp', 'flp', 'fil'] },
  { name: 'Colossenses', chapters: 4, aliases: ['colossenses', 'cl', 'col'] },
  { name: '1 Tessalonicenses', chapters: 5, aliases: ['1 tessalonicenses', '1tessalonicenses', '1 ts', '1ts', '1 tes'] },
  { name: '2 Tessalonicenses', chapters: 3, aliases: ['2 tessalonicenses', '2tessalonicenses', '2 ts', '2ts', '2 tes'] },
  { name: '1 Timóteo', chapters: 6, aliases: ['1 timoteo', '1timoteo', '1 tm', '1tm', '1 tim'] },
  { name: '2 Timóteo', chapters: 4, aliases: ['2 timoteo', '2timoteo', '2 tm', '2tm', '2 tim'] },
  { name: 'Tito', chapters: 3, aliases: ['tito', 'tt', 'tit'] },
  { name: 'Filemom', chapters: 1, aliases: ['filemom', 'fm', 'flm'] },
  { name: 'Hebreus', chapters: 13, aliases: ['hebreus', 'hb', 'heb'] },
  { name: 'Tiago', chapters: 5, aliases: ['tiago', 'tg', 'tia'] },
  { name: '1 Pedro', chapters: 5, aliases: ['1 pedro', '1pedro', '1 pe', '1pe', '1 ped'] },
  { name: '2 Pedro', chapters: 3, aliases: ['2 pedro', '2pedro', '2 pe', '2pe', '2 ped'] },
  { name: '1 João', chapters: 5, aliases: ['1 joao', '1joao', '1 jo', '1jo'] },
  { name: '2 João', chapters: 1, aliases: ['2 joao', '2joao', '2 jo', '2jo'] },
  { name: '3 João', chapters: 1, aliases: ['3 joao', '3joao', '3 jo', '3jo'] },
  { name: 'Judas', chapters: 1, aliases: ['judas', 'jd', 'jud'] },
  { name: 'Apocalipse', chapters: 22, aliases: ['apocalipse', 'ap', 'apo', 'rev'] },
];

function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Tenta extrair a referência a um Livro e Capítulo da Bíblia a partir de um texto ou título.
 */
export function extractBibleReference(text: string): { book: string; chapter: number } | null {
  if (!text || !text.trim()) return null;

  const normalized = normalizeStr(text);

  const sortedBooks = [...BIBLE_BOOKS].sort((a, b) => {
    const maxA = Math.max(...[a.name, ...a.aliases].map((s) => s.length));
    const maxB = Math.max(...[b.name, ...b.aliases].map((s) => s.length));
    return maxB - maxA;
  });

  for (const book of sortedBooks) {
    const allNames = [normalizeStr(book.name), ...book.aliases.map(normalizeStr)];

    for (const name of allNames) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(
        `(?:\\b|^)${escapedName}(?:\\s+cap[ií]tulo|\\s+cap\\.?)?\\s+(\\d{1,3})(?:[:.,\\s]\\d+)?\\b`,
        'i'
      );

      const match = normalized.match(regex);
      if (match && match[1]) {
        const chapter = parseInt(match[1], 10);
        if (chapter > 0 && chapter <= book.chapters) {
          return {
            book: book.name,
            chapter,
          };
        }
      }
    }
  }

  return null;
}
