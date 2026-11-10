/* Entre Linhas — integração gradual do Clube com Cloudflare staging. */
(function (root) {
  'use strict';
  function notifySafe(title, message) {
    try {
      if (typeof root.notify === 'function') root.notify(title, message);
      else if (typeof root.info === 'function') root.info(title, message);
      else console.info('[EntreLinhas Cloudflare]', title, message);
    } catch (_) {}
  }
  function api() {
    if (!root.EntreLinhasCloudflare) throw new Error('Cliente Cloudflare não foi carregado.');
    return root.EntreLinhasCloudflare;
  }
  root.addPhotoToAlbumV47 = async function (albumId, file) {
    if (!file) return;
    try {
      if (typeof root.isAdminSafe === 'function' && !root.isAdminSafe()) {
        return notifySafe('Acesso restrito', 'Somente a administração pode adicionar fotos.');
      }
      if (!albumId) throw new Error('Álbum não informado.');
      notifySafe('Enviando foto', 'Enviando para o armazenamento privado do Cloudflare…');
      const result = await api().clubAlbums.addPhoto(albumId, file);
      const photoId = result && result.photo && result.photo.id;
      if (!photoId && !result.already_attached) throw new Error('A API não confirmou o vínculo da foto ao álbum.');
      try {
        if (typeof root.openAlbumV47 === 'function') await root.openAlbumV47(albumId);
        else if (typeof root.renderSafe === 'function') root.renderSafe();
      } catch (_) {}
      notifySafe('Foto enviada', 'Arquivo salvo no R2 privado e vinculado ao álbum no D1.');
      return result;
    } catch (error) {
      console.error('[EntreLinhas Cloudflare] Falha ao enviar foto:', error);
      notifySafe('Erro ao enviar foto', error && error.message || 'Não foi possível concluir o envio.');
      throw error;
    }
  };
  root.entreLinhasCloudflareClubPhotos = Object.freeze({
    list: function (albumId, options) { return api().clubAlbums.listPhotos(albumId, options); },
    download: function (photoId) { return api().clubAlbums.downloadPhoto(photoId); },
    remove: function (photoId) { return api().clubAlbums.removePhoto(photoId); }
  });
  root.__ENTRELINHAS_CLOUDFLARE_CLUB_PHOTOS__ = true;
})(window);
