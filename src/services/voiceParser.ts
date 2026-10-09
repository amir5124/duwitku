// src/services/voiceParser.ts
// Fallback parser untuk voice input tanpa Claude API

export interface ParsedTransaction {
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    category: string;
    merchant: string;
    note: string;
    confidence: number;
    _raw?: string;
    _detected?: {
      isExpense: boolean;
      isIncome: boolean;
      amountFound: boolean;
    };
  }
  
  const CATEGORY_KEYWORDS: Record<string, string[]> = {
    MAKANAN: ['makan', 'minum', 'resto', 'warteg', 'cafe', 'kopi', 'teh', 'mie', 'nasi', 'ayam', 'bakso', 'soto', 'pecel', 'rawon', 'sate', 'gado-gado', 'ketoprak'],
    TRANSPORTASI: ['gojek', 'grab', 'taxi', 'bensin', 'motor', 'mobil', 'bbm', 'transport', 'ojol', 'bus', 'kereta', 'pesawat', 'kapal', 'angkot', 'becak', 'delman'],
    BELANJA: ['belanja', 'shopping', 'baju', 'sepatu', 'tas', 'parfum', 'kosmetik', 'peralatan', 'rumah tangga', 'furniture', 'elektronik', 'hp', 'handphone'],
    TAGIHAN: ['listrik', 'air', 'internet', 'telepon', 'bpjs', 'token', 'pln', 'pdam', 'indihome', 'wifi', 'tv', 'kabel', 'gas', 'pbb', 'pajak', 'asuransi'],
    KESEHATAN: ['obat', 'dokter', 'rumah sakit', 'vitamin', 'apotek', 'klinik', 'puskesmas', 'periksa', 'tes', 'lab', 'ct scan', 'rontgen', 'operasi'],
    PENDIDIKAN: ['buku', 'kursus', 'les', 'sekolah', 'kuliah', 'seminar', 'workshop', 'pelatihan', 'tutorial', 'privat', 'bimbel', 'snbt', 'utbk'],
    HIBURAN: ['bioskop', 'game', 'netflix', 'liburan', 'wisata', 'travel', 'nonton', 'konser', 'festival', 'musik', 'film', 'anime', 'komik', 'mainan'],
    KUOTA: ['pulsa', 'kuota', 'paket data', 'smartfren', 'telkomsel', 'indosat', 'xl', 'axis', 'tri', 'by.u', 'menara', 'im3', 'm3'],
    KOS: ['kos', 'sewa', 'kontrak', 'rumah', 'kost', 'apartemen', 'kamar', 'kost eksklusif', 'indekos', 'petak', 'kontrakan'],
    HUTANG: ['hutang', 'angsuran', 'cicilan', 'kpr', 'utang', 'kredit', 'pinjaman', 'kta', 'multiguna'],
    ZAKAT: ['zakat', 'sedekah', 'infak', 'donasi', 'amal', 'derma', 'bantuan', 'sumbangan', 'wakaf'],
    GAJI: ['gaji', 'salary', 'honor', 'upah', 'fee', 'pendapatan', 'penghasilan', 'remunerasi', 'kompensasi'],
    BONUS: ['bonus', 'thr', 'reward', 'komisi', 'insentif', 'tunjangan'],
    INVESTASI: ['investasi', 'reksadana', 'saham', 'emas', 'crypto', 'bitcoin', 'obligasi', 'deposito', 'valas', 'forex'],
    FREELANCE: ['freelance', 'project', 'order', 'jasa', 'service', 'proyek', 'pekerjaan', 'tugas', 'job'],
    BISNIS: ['bisnis', 'jualan', 'dagang', 'usaha', 'toko', 'warung', 'kedai', 'resto', 'cafe', 'distro', 'online shop'],
  };
  
  const EXPENSE_KEYWORDS = [
    'beli', 'bayar', 'habis', 'keluar', 'belanja', 'makan', 'minum', 
    'gojek', 'grab', 'bensin', 'listrik', 'air', 'internet', 'pulsa',
    'kuota', 'kos', 'sewa', 'hutang', 'angsuran', 'cicilan', 'obat',
    'dokter', 'buku', 'kursus', 'tiket', 'transport', 'ojol', 'taxi'
  ];
  
  const INCOME_KEYWORDS = [
    'gaji', 'dapat', 'terima', 'bonus', 'income', 'pemasukan', 'honor',
    'fee', 'upah', 'salary', 'receive', 'transfer', 'masuk', 'kirim',
    'bayaran', 'komisi', 'thr', 'reward', 'investasi', 'dividen'
  ];
  
  export function parseVoiceText(text: string): ParsedTransaction {
    const lower = text.toLowerCase();
    
    // 1. Deteksi tipe transaksi
    const isExpense = EXPENSE_KEYWORDS.some(kw => lower.includes(kw));
    const isIncome = INCOME_KEYWORDS.some(kw => lower.includes(kw));
    
    let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';
    if (isIncome && !isExpense) {
      type = 'INCOME';
    } else if (!isExpense && !isIncome) {
      // Default: cek jika ada kata "gaji" atau "dapat" atau "terima"
      if (lower.includes('gaji') || lower.includes('dapat') || lower.includes('terima') || lower.includes('bonus')) {
        type = 'INCOME';
      }
    }
    
    // 2. Ekstrak nominal
    let amount = 0;
    
    const patterns = [
      /(\d+[\.,]?\d*)\s*(?:rb|ribu|k|kilo)/i,
      /(\d+[\.,]?\d*)\s*(?:jt|juta|juta-an)/i,
      /(?:rp|Rp|IDR|idr|idr)\s*([\d.,]+)/i,
      /(?:sebesar|sekitar|kurang lebih|±|lebih|kurang|total)\s*([\d.,]+)/i,
      /([\d.,]+)\s*(?:ribu|ratus|juta|miliar)/i,
      /(\d{1,3}(?:[.,]\d{3})*)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let val = parseFloat(match[1].replace(/\./g, '').replace(/,/g, '.'));
        
        if (isNaN(val)) continue;
        
        // Cek satuan di sekitar match
        const context = text.substring(
          Math.max(0, match.index! - 20),
          Math.min(text.length, match.index! + match[0].length + 20)
        );
        const lowerContext = context.toLowerCase();
        
        if (lowerContext.includes('rb') || lowerContext.includes('ribu') || lowerContext.includes('k')) {
          val *= 1000;
        }
        if (lowerContext.includes('jt') || lowerContext.includes('juta')) {
          val *= 1000000;
        }
        if (lowerContext.includes('m') && !lowerContext.includes('ribu') && !lowerContext.includes('rb')) {
          val *= 1000000;
        }
        
        // Deteksi "setengah" atau "separuh"
        if (lowerContext.includes('setengah') || lowerContext.includes('separuh') || lowerContext.includes('1/2')) {
          val = val / 2;
        }
        
        if (val > 0) {
          amount = Math.round(val);
          break;
        }
      }
    }
    
    // 3. Kategori
    let category = 'LAINNYA';
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(kw => lower.includes(kw))) {
        category = cat;
        break;
      }
    }
    
    // Jika category LAINNYA dan type INCOME, coba deteksi dari kata kunci income
    if (category === 'LAINNYA' && type === 'INCOME') {
      if (lower.includes('gaji')) category = 'GAJI';
      else if (lower.includes('bonus') || lower.includes('thr')) category = 'BONUS';
      else if (lower.includes('investasi') || lower.includes('saham') || lower.includes('emas')) category = 'INVESTASI';
      else if (lower.includes('freelance') || lower.includes('project') || lower.includes('order')) category = 'FREELANCE';
      else if (lower.includes('bisnis') || lower.includes('jualan') || lower.includes('dagang')) category = 'BISNIS';
    }
    
    // 4. Merchant (nama toko/tempat)
    let merchant = '';
    
    const merchantPatterns = [
      /(?:di|dari|ke|beli|pesan)\s+([a-z][a-z\s]{2,30})(?:\s+(?:sebesar|sekitar|total|bayar|ambil|makan|minum)|\s*$)/i,
      /(?:di|dari)\s+([a-z][a-z\s]{2,30})$/i,
      /toko\s*[:]\s*([^\n,]+)/i,
      /merchant\s*[:]\s*([^\n,]+)/i,
      /store\s*[:]\s*([^\n,]+)/i,
    ];
    
    for (const pattern of merchantPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        merchant = match[1].trim();
        // Bersihkan dari kata-kata tidak perlu
        merchant = merchant.replace(/\b(sebesar|sekitar|total|bayar|ambil|makan|minum|beli|pesan|dari|ke)\b/gi, '').trim();
        if (merchant.length > 2 && merchant.length < 50) {
          break;
        }
      }
    }
    
    // Jika merchant kosong, coba ambil kata setelah "di" atau "dari" tanpa keyword lain
    if (!merchant) {
      const diMatch = text.match(/(?:di|dari)\s+([a-z][a-z\s]{2,20})(?:\s|$)/i);
      if (diMatch && diMatch[1]) {
        merchant = diMatch[1].trim();
        if (merchant.length > 50) merchant = merchant.slice(0, 50);
      }
    }
    
    // 5. Note (sisa teks)
    let note = text;
    // Hapus nominal
    note = note.replace(/\d+[\.,]?\d*\s*(?:rb|ribu|jt|juta|k|m)?/gi, '');
    // Hapus kata di/dari + merchant
    if (merchant) {
      note = note.replace(new RegExp(`(?:di|dari)\\s*${merchant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '');
    }
    // Hapus keyword transaksi
    const removeWords = ['beli', 'bayar', 'habis', 'keluar', 'dapat', 'terima', 'gaji', 'bonus', 'honor', 'fee', 'upah'];
    for (const word of removeWords) {
      note = note.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    }
    note = note.replace(/\s+/g, ' ').trim();
    if (note.length > 100) note = note.slice(0, 100);
    if (!note) {
      note = type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran';
    }
    
    // 6. Confidence
    let confidence = 0.3;
    if (amount > 0) confidence = 0.5;
    if (amount > 0 && category !== 'LAINNYA') confidence = 0.65;
    if (amount > 0 && category !== 'LAINNYA' && merchant) confidence = 0.75;
    if (amount > 0 && category !== 'LAINNYA' && merchant && type) confidence = 0.85;
    
    return {
      type,
      amount,
      category,
      merchant,
      note,
      confidence,
      _raw: text,
      _detected: {
        isExpense,
        isIncome,
        amountFound: amount > 0,
      }
    };
  }
  
  // Fungsi untuk format hasil parse menjadi teks yang lebih friendly
  export function formatParsedResult(parsed: ParsedTransaction): string {
    const typeLabel = parsed.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran';
    const categoryLabel = parsed.category || 'Kategori';
    const amountLabel = `Rp${parsed.amount.toLocaleString()}`;
    let result = `${typeLabel} ${amountLabel}`;
    if (parsed.category && parsed.category !== 'LAINNYA') {
      result += ` untuk ${categoryLabel}`;
    }
    if (parsed.merchant) {
      result += ` di ${parsed.merchant}`;
    }
    if (parsed.note && parsed.note !== 'Pemasukan' && parsed.note !== 'Pengeluaran') {
      result += ` (${parsed.note})`;
    }
    return result;
  }