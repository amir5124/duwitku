import { supabase } from './supabase/client';

export type TransactionCategory =
  | 'MAKANAN' | 'TRANSPORTASI' | 'BELANJA' | 'TAGIHAN' | 'KESEHATAN'
  | 'PENDIDIKAN' | 'HIBURAN' | 'KUOTA' | 'KOS' | 'HUTANG' | 'ZAKAT'
  | 'GAJI' | 'BONUS' | 'INVESTASI' | 'FREELANCE' | 'BISNIS' | 'LAINNYA'
  | 'TABUNGAN' | 'HADIAH' | 'KEBUTUHAN';

export interface ParsedTransaction {
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: TransactionCategory;
  merchant?: string;
  description: string;
  confidence: number;
}

const parseCache = new Map<string, ParsedTransaction[]>();
const CACHE_MAX_SIZE = 100;

export class ClaudeParseError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'ClaudeParseError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULES BERBASIS KEYWORD — Filter sebelum ke Claude (hemat biaya)
// ─────────────────────────────────────────────────────────────────────────────

// Keyword INCOME
const INCOME_KEYWORDS = [
  'gaji', 'gajian', 'digaji', 'terima gaji',
  'bonus', 'thr', 'dapat bonus',
  'dapat uang', 'dapet uang', 'terima uang',
  'dibayar', 'dibayarin', 'bayaran',
  'freelance', 'fee', 'honor', 'honorarium',
  'jualan', 'laku', 'profit', 'untung', 'keuntungan',
  'dagang', 'omzet', 'pendapatan',
  'investasi cair', 'dividen', 'bunga',
  'hadiah', 'kado', 'reward',
  'refund', 'kembalian uang',
  'transfer masuk', 'terima transfer',
];

// Keyword EXPENSE
const EXPENSE_KEYWORDS = [
  'beli', 'bayar', 'bayarin', 'bayar',
  'makan', 'minum', 'jajan', 'ngemil',
  'belanja', 'shopping', 'beli',
  'transfer', 'kirim uang', 'kirimin',
  'topup', 'top up', 'isi saldo',
  'cicil', 'cicilan', 'angsuran',
  'habis', 'abis', 'keluar',
  'traktir', 'traktirannya', 'traktiran',
  'isi bensin', 'bensin', 'parkir',
  'sewa', 'kontrak', 'kos',
  'tagihan', 'bayar listrik', 'bayar air',
  'obat', 'dokter', 'periksa',
  'kursus', 'les', 'sekolah',
  'nonton', 'bioskop', 'game',
  'pulsa', 'kuota', 'paket data',
  'hutang', 'bayar hutang',
  'zakat', 'sedekah', 'infak',
  'nabung', 'tabung', 'simpan',
];

// Keyword NOMINAL — wajib ada minimal salah satu
const NOMINAL_PATTERNS = [
  /\d+\s*(rb|ribu|k|jt|juta|ratus|m|miliar)/i,
  /rp\.?\s*\d+/i,
  /\d{4,}/,  // angka 4 digit ke atas (1000+)
  /\d+\.\d{3}/,  // format 10.000
  /\d+,\d{3}/,   // format 10,000
];

// Keyword NON-TRANSAKSI — langsung reject tanpa ke Claude
const NON_TRANSACTION_KEYWORDS = [
  'halo', 'hai', 'hey', 'hi',
  'kamu siapa', 'kamu apa', 'siapa kamu',
  'apa kabar', 'gimana kabar',
  'terima kasih', 'makasih', 'thanks',
  'ok', 'oke', 'iya', 'ya', 'tidak', 'nggak',
  'bagus', 'mantap', 'keren', 'sip',
  'tolong', 'bantu', 'help',
  'selamat pagi', 'selamat siang', 'selamat malam',
  'bisa apa', 'bisa bantu', 'fitur apa',
];

// ─────────────────────────────────────────────────────────────────────────────
// RULES KATEGORI OTOMATIS — Pre-classify sebelum ke Claude
// Claude tetap bisa override ini, tapi ini mengurangi hallucination
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_RULES: { keywords: string[]; category: TransactionCategory }[] = [
  {
    keywords: ['makan', 'minum', 'nasi', 'ayam', 'soto', 'bakso', 'warteg',
      'resto', 'restoran', 'cafe', 'kafe', 'kopi', 'es teh', 'es', 'jus',
      'pizza', 'burger', 'mie', 'indomie', 'gorengan', 'snack', 'cemilan',
      'ngemil', 'jajan', 'sarapan', 'makan siang', 'makan malam', 'dinner',
      'lunch', 'breakfast', 'minuman', 'boba', 'milk tea'],
    category: 'MAKANAN',
  },
  {
    keywords: ['gojek', 'grab', 'ojek', 'taxi', 'taksi', 'bensin', 'bbm',
      'pertalite', 'pertamax', 'solar', 'motor', 'mobil', 'bis', 'bus',
      'kereta', 'krl', 'mrt', 'lrt', 'angkot', 'angkutan', 'parkir',
      'tol', 'tiket pesawat', 'pesawat', 'travel', 'transportasi'],
    category: 'TRANSPORTASI',
  },
  {
    keywords: ['belanja', 'shopping', 'baju', 'sepatu', 'tas', 'celana',
      'kaos', 'kemeja', 'dress', 'sandal', 'aksesoris', 'jam tangan',
      'tokopedia', 'shopee', 'lazada', 'toko', 'supermarket', 'indomaret',
      'alfamart', 'minimarket', 'hypermart', 'carrefour'],
    category: 'BELANJA',
  },
  {
    keywords: ['listrik', 'pln', 'air', 'pdam', 'internet', 'wifi', 'indihome',
      'biznet', 'firstmedia', 'telepon', 'bpjs', 'asuransi', 'tagihan'],
    category: 'TAGIHAN',
  },
  {
    keywords: ['obat', 'dokter', 'rumah sakit', 'rs', 'klinik', 'apotek',
      'vitamin', 'suplemen', 'periksa', 'konsultasi', 'operasi', 'rawat',
      'puskesmas', 'bidan', 'mantri'],
    category: 'KESEHATAN',
  },
  {
    keywords: ['buku', 'kursus', 'les', 'sekolah', 'kuliah', 'kampus',
      'ukt', 'spp', 'pendidikan', 'kelas', 'workshop', 'seminar',
      'udemy', 'dicoding', 'ruangguru', 'zenius'],
    category: 'PENDIDIKAN',
  },
  {
    keywords: ['nonton', 'bioskop', 'cinema', 'cgv', 'xxi', 'netflix',
      'spotify', 'youtube premium', 'game', 'steam', 'mobile legend',
      'liburan', 'wisata', 'hotel', 'penginapan', 'hiburan'],
    category: 'HIBURAN',
  },
  {
    keywords: ['pulsa', 'kuota', 'paket data', 'kartu', 'telkomsel',
      'xl', 'indosat', 'tri', 'smartfren', 'by.u'],
    category: 'KUOTA',
  },
  {
    keywords: ['kos', 'kost', 'kontrakan', 'kontrak', 'sewa rumah',
      'sewa kamar', 'ngekos', 'bayar kos', 'bayar kontrakan'],
    category: 'KOS',
  },
  {
    keywords: ['hutang', 'utang', 'bayar hutang', 'bayar utang',
      'cicilan', 'angsuran', 'kredit'],
    category: 'HUTANG',
  },
  {
    keywords: ['zakat', 'sedekah', 'infak', 'infaq', 'shodaqoh',
      'donasi', 'sumbangan', 'amal'],
    category: 'ZAKAT',
  },
  {
    keywords: ['gaji', 'gajian', 'salary', 'upah', 'honor', 'honorarium'],
    category: 'GAJI',
  },
  {
    keywords: ['bonus', 'thr', 'insentif', 'komisi'],
    category: 'BONUS',
  },
  {
    keywords: ['investasi', 'reksadana', 'reksa dana', 'saham', 'obligasi',
      'dividen', 'bunga deposito', 'deposito', 'emas'],
    category: 'INVESTASI',
  },
  {
    keywords: ['freelance', 'project', 'proyek', 'klien', 'client',
      'order', 'desain', 'coding', 'nulis', 'konten', 'content'],
    category: 'FREELANCE',
  },
  {
    keywords: ['jualan', 'dagang', 'bisnis', 'usaha', 'omzet',
      'pendapatan', 'profit', 'untung', 'laba'],
    category: 'BISNIS',
  },
  {
    keywords: ['nabung', 'tabung', 'tabungan', 'simpan', 'celengan'],
    category: 'TABUNGAN',
  },
  {
    keywords: ['hadiah', 'kado', 'gift', 'reward', 'dapat hadiah'],
    category: 'HADIAH',
  },
  {
    keywords: ['sabun', 'shampo', 'deterjen', 'pasta gigi', 'sikat gigi',
      'tissue', 'kebutuhan rumah', 'dapur', 'sembako', 'beras', 'minyak',
      'telur', 'gula', 'garam'],
    category: 'KEBUTUHAN',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function hasNominal(text: string): boolean {
  return NOMINAL_PATTERNS.some(p => p.test(text));
}

function isNonTransaction(text: string): boolean {
  const lower = text.toLowerCase().trim();
  // Teks sangat pendek tanpa nominal
  if (lower.length < 5 && !hasNominal(text)) return true;
  return NON_TRANSACTION_KEYWORDS.some(k => lower === k || lower.startsWith(k + ' ') || lower.endsWith(' ' + k));
}

function isTransactionText(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (isNonTransaction(lower)) return false;
  if (hasNominal(text)) return true;
  const allKeywords = [...INCOME_KEYWORDS, ...EXPENSE_KEYWORDS];
  return allKeywords.some(k => lower.includes(k));
}

function guessType(text: string): 'INCOME' | 'EXPENSE' | null {
  const lower = text.toLowerCase();
  const incomeScore = INCOME_KEYWORDS.filter(k => lower.includes(k)).length;
  const expenseScore = EXPENSE_KEYWORDS.filter(k => lower.includes(k)).length;
  if (incomeScore > expenseScore) return 'INCOME';
  if (expenseScore > incomeScore) return 'EXPENSE';
  return null;
}

function guessCategory(text: string): TransactionCategory | null {
  const lower = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return rule.category;
    }
  }
  return null;
}

// Normalisasi nominal dari teks
function extractNominals(text: string): number[] {
  const results: number[] = [];
  const lower = text.toLowerCase();

  // Pattern: angka + satuan (20rb, 5jt, dll)
  const matches = lower.matchAll(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta|m|miliar|ratus)?/gi);
  for (const match of matches) {
    let num = parseFloat(match[1].replace(',', '.'));
    const satuan = (match[2] || '').toLowerCase();
    if (satuan === 'rb' || satuan === 'ribu' || satuan === 'k') num *= 1000;
    else if (satuan === 'jt' || satuan === 'juta') num *= 1_000_000;
    else if (satuan === 'm' || satuan === 'miliar') num *= 1_000_000_000;
    else if (satuan === 'ratus') num *= 100;
    if (num >= 100) results.push(num); // minimum Rp100
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PARSE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
export async function parseTransactionsWithClaude(
  text: string,
  options?: { forceRefresh?: boolean }
): Promise<ParsedTransaction[]> {

  // 1. Validasi panjang
  if (!text || typeof text !== 'string' || text.trim().length < 2) {
    throw new ClaudeParseError('Teks terlalu pendek');
  }

  const trimmed = text.trim();

  // 2. Filter non-transaksi
  if (!isTransactionText(trimmed)) {
    throw new ClaudeParseError('Bukan transaksi keuangan');
  }

  // 3. Cache check
  const cacheKey = trimmed.toLowerCase();
  if (!options?.forceRefresh && parseCache.has(cacheKey)) {
    console.log('📦 Cache hit');
    return parseCache.get(cacheKey)!;
  }

  // 4. Pre-analysis lokal untuk kirim hint ke Claude
  const guessedType    = guessType(trimmed);
  const guessedCat     = guessCategory(trimmed);
  const nominals       = extractNominals(trimmed);
  const nominalHint    = nominals.length > 0 ? `Nominal terdeteksi: ${nominals.join(', ')}` : '';
  const typeHint       = guessedType ? `Tipe kemungkinan: ${guessedType}` : '';
  const categoryHint   = guessedCat ? `Kategori kemungkinan: ${guessedCat}` : '';

  console.log(`🤖 Hints → type:${guessedType} cat:${guessedCat} nominals:${nominals}`);

  try {
    const { data, error } = await supabase.functions.invoke('parse-transaction', {
      body: {
        text: trimmed,
        hints: { typeHint, categoryHint, nominalHint },
      },
    });

    if (error) {
      let detail = error.message;
      try {
        const errBody = await (error as any).context?.json?.();
        if (errBody?.error) detail = errBody.error;
      } catch { /* ignore */ }
      throw new ClaudeParseError(`Edge Function error: ${detail}`);
    }

    if (data?.error) {
      throw new ClaudeParseError(`Edge Function error: ${data.error}`);
    }

    if (!data?.transactions || !Array.isArray(data.transactions)) {
      throw new ClaudeParseError('Invalid response from Edge Function');
    }

    const result = data.transactions as ParsedTransaction[];

    if (result.length === 0) {
      throw new ClaudeParseError('Tidak ada transaksi yang terdeteksi');
    }

    // 5. Post-processing — pastikan kategori & tipe masuk akal
    const processed = result.map(tx => ({
      ...tx,
      // Kalau Claude tidak yakin tipe, pakai hint lokal
      type: tx.confidence < 0.5 && guessedType ? guessedType : tx.type,
      // Kalau Claude tidak yakin kategori, pakai hint lokal
      category: tx.confidence < 0.5 && guessedCat ? guessedCat : tx.category,
    }));

    console.log(`✅ Parsed ${processed.length} transactions`);

    // 6. Cache hasil
    parseCache.set(cacheKey, processed);
    if (parseCache.size > CACHE_MAX_SIZE) {
      const firstKey = parseCache.keys().next().value;
      if (firstKey) parseCache.delete(firstKey);
    }

    return processed;

  } catch (error) {
    if (error instanceof ClaudeParseError) throw error;
    throw new ClaudeParseError(
      'Gagal memparse transaksi: ' + (error instanceof Error ? error.message : String(error)),
      error
    );
  }
}

export function clearParseCache(): void {
  parseCache.clear();
  console.log('🗑️ Cache cleared');
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT HELPERS (untuk testing atau UI preview)
// ─────────────────────────────────────────────────────────────────────────────
export { extractNominals, guessCategory, guessType, isTransactionText };
