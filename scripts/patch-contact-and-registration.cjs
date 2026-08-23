const fs = require('fs');

const chat = 'app/chat/page.tsx';
let s = fs.readFileSync(chat, 'utf8');

const oldFilter = `  const filteredUsers =
    users.filter(
      (user) => {
        const keyword =
          search
            .trim()
            .toLowerCase();

        if (!keyword) {
          return true;
        }

        return (
          user.full_name
            .toLowerCase()
            .includes(
              keyword
            ) ||
          user.username
            ?.toLowerCase()
            .includes(
              keyword
            )
        );
      }
    );`;

const newFilter = `  const filteredUsers =
    users.filter(
      (user) => {
        const keyword =
          search
            .trim()
            .toLowerCase();

        const isContact =
          Boolean(contactInfo[user.id]?.conversationId);

        /* Beranda hanya menampilkan kontak yang sudah memiliki percakapan. */
        if (!keyword) {
          return isContact;
        }

        /* Pencarian harus cocok 100% dengan nama lengkap atau username. */
        return (
          user.full_name
            .trim()
            .toLowerCase() ===
            keyword ||
          user.username
            ?.trim()
            .toLowerCase() ===
            keyword
        );
      }
    );`;

if (s.includes(oldFilter)) {
  s = s.replace(oldFilter, newFilter);
} else if (!s.includes('const isContact =')) {
  throw new Error('Blok filteredUsers tidak ditemukan.');
}

s = s.replace(
  '                  {users.length}\n',
  '                  {filteredUsers.length}\n'
);
s = s.replace(
  '                    Belum ada pengguna lain\n',
  '                    Belum ada kontak\n'
);
s = s.replace(
  '                    Daftar pengguna akan muncul di sini.\n',
  '                    Cari nama akun atau username secara tepat untuk menambahkan kontak baru.\n'
);

const oldHeader = `          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={(event) => {`;

const newHeader = `          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/chat/grup"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              title="Grup Banda Chat"
            >
              <span aria-hidden="true">👥</span>
              <span className="hidden sm:inline">Grup</span>
            </a>

            <button
              type="button"
              onClick={(event) => {`;

if (s.includes(oldHeader)) {
  s = s.replace(oldHeader, newHeader);
} else if (!s.includes('href="/chat/grup"')) {
  throw new Error('Header Banda Chat tidak ditemukan.');
}

fs.writeFileSync(chat, s);

const reg = 'app/daftar/page.tsx';
let r = fs.readFileSync(reg, 'utf8');

const oldRegisterBlock = `      /*
       * Jika Supabase langsung memberikan session,
       * langsung masuk chat.
       */
      if (data.session?.user) {
        window.location.href =
          "/chat";
        return;
      }

      /*
       * Jika email confirmation aktif,
       * tampilkan informasi.
       */
      setSuccessMessage(
        "Akun berhasil dibuat. Silakan cek email Anda jika diminta melakukan konfirmasi, kemudian masuk ke Banda Chat."
      );

      setFullName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");`;

const newRegisterBlock = `      /*
       * Jika Supabase langsung memberikan session,
       * langsung masuk chat.
       */
      if (data.session?.user) {
        window.location.href =
          "/chat";
        return;
      }

      /*
       * Jika signUp berhasil tetapi session tidak langsung dikembalikan,
       * lakukan login otomatis agar pengguna tidak perlu kembali ke halaman login.
       */
      const {
        data: autoLoginData,
        error: autoLoginError,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (autoLoginError) {
        throw new Error(
          "Akun berhasil dibuat, tetapi login otomatis gagal. Pastikan konfirmasi email Supabase tidak diwajibkan."
        );
      }

      if (autoLoginData.session?.user) {
        window.location.href =
          "/chat";
        return;
      }

      throw new Error(
        "Akun berhasil dibuat, tetapi sesi login otomatis tidak tersedia."
      );`;

if (r.includes(oldRegisterBlock)) {
  r = r.replace(oldRegisterBlock, newRegisterBlock);
} else if (!r.includes('signInWithPassword({')) {
  throw new Error('Blok registrasi tidak ditemukan.');
}

fs.writeFileSync(reg, r);
console.log('Banda Chat contact/search, group menu, and auto-login patch applied.');
