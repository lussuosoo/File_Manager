import React, { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

const initialData = {
  id: 'root',
  name: 'Корень',
  type: 'folder',
  children: [],
};

const textFileExtensions = ['txt', 'js', 'json', 'css', 'html', 'md', 'csv'];
const unsupportedPreviewExtensions = ['doc'];

function DocxViewer({ file }) {
  const [html, setHtml] = React.useState('');

  React.useEffect(() => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(event) {
      const arrayBuffer = event.target.result;

      mammoth.convertToHtml({
        arrayBuffer,
        convertImage: mammoth.images.inline(function(element) {
          return element.read("base64").then(function(imageBuffer) {
            return {
              src: "data:" + element.contentType + ";base64," + imageBuffer
            };
          });
        })
      })
      .then(result => setHtml(result.value))
      .catch(() => setHtml('<p>Ошибка при конвертации файла</p>'));
    };

    reader.readAsArrayBuffer(file);
  }, [file]);

  return (
    <div className="docx-viewer" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export default function FileManager() {
  const [data, setData] = useState(() => {
    const savedData = localStorage.getItem('fileManagerData');
    return savedData ? JSON.parse(savedData) : initialData;
  });
  
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('fileManagerDarkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });
  const [bookmarks, setBookmarks] = useState(() => {
    const savedBookmarks = localStorage.getItem('fileManagerBookmarks');
    return savedBookmarks ? JSON.parse(savedBookmarks) : [];
  });
  const [showBookmarks, setShowBookmarks] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('fileManagerData', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem('fileManagerDarkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('fileManagerBookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  const findFolderById = (folder, id) => {
    if (folder.id === id) return folder;
    if (!folder.children) return null;
    for (const child of folder.children) {
      if (child.type === 'folder') {
        const found = findFolderById(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  const findItemById = (folder, id) => {
    if (folder.id === id) return folder;
    if (!folder.children) return null;
    for (const child of folder.children) {
      if (child.id === id) return child;
      if (child.type === 'folder') {
        const found = findItemById(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  const currentFolder = findFolderById(data, currentFolderId);

  const handleAddFiles = (files) => {
    if (!files.length) return;
    const newFiles = Array.from(files).map(file => ({
      id: generateId(),
      name: file.name,
      type: 'file',
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));

    const updatedData = {...data};
    const folder = findFolderById(updatedData, currentFolderId);
    folder.children = folder.children.concat(newFiles);
    setData(updatedData);
  };

  const handleAddNote = () => {
    if (!newName.trim()) return alert('Введите название заметки');
    const newNote = {
      id: generateId(),
      name: newName.trim(),
      type: 'note',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updatedData = {...data};
    const folder = findFolderById(updatedData, currentFolderId);
    folder.children.push(newNote);
    setData(updatedData);
    setNewName('');
  };

  const handleAddFolder = () => {
    if (!newName.trim()) return alert('Введите название папки');
    const newFolder = {
      id: generateId(),
      name: newName.trim(),
      type: 'folder',
      children: [],
    };
    const updatedData = {...data};
    const folder = findFolderById(updatedData, currentFolderId);
    folder.children.push(newFolder);
    setData(updatedData);
    setNewName('');
  };

  const handleDelete = (id, folder = data) => {
    if (!folder.children) return false;
    const index = folder.children.findIndex(child => child.id === id);
    if (index !== -1) {
      folder.children.splice(index, 1);
      return true;
    }
    for (const child of folder.children) {
      if (child.type === 'folder') {
        const deleted = handleDelete(id, child);
        if (deleted) return true;
      }
    }
    return false;
  };

  const deleteItem = (id) => {
    const updatedData = {...data};
    handleDelete(id, updatedData);
    setData(updatedData);
    if (previewFile && previewFile.id === id) {
      closePreview();
    }
    // Удаляем из закладок, если элемент там есть
    setBookmarks(prev => prev.filter(bookmarkId => bookmarkId !== id));
  };

  const renameItem = (id, newName, folder = data) => {
    if (folder.id === id) {
      folder.name = newName;
      return true;
    }
    if (!folder.children) return false;
    for (const child of folder.children) {
      if (child.id === id) {
        child.name = newName;
        if (child.type === 'note') {
          child.updatedAt = new Date().toISOString();
        }
        return true;
      }
      if (child.type === 'folder') {
        const renamed = renameItem(id, newName, child);
        if (renamed) return true;
      }
    }
    return false;
  };

  const startRenaming = (id, currentName) => {
    setEditingId(id);
    setNewName(currentName);
  };

  const finishRenaming = (id) => {
    if (!newName.trim()) return alert('Название не может быть пустым');
    const updatedData = {...data};
    renameItem(id, newName.trim(), updatedData);
    setData(updatedData);
    setEditingId(null);
    setNewName('');
  };

  const [path, setPath] = useState(['root']);
  const goToFolder = (id) => {
    setCurrentFolderId(id);
    setPath((prev) => [...prev, id]);
    setShowBookmarks(false);
  };
  const goBack = (index) => {
    const newPath = path.slice(0, index + 1);
    setPath(newPath);
    setCurrentFolderId(newPath[newPath.length - 1]);
    setShowBookmarks(false);
  };

  const filterItems = (items) => {
    if (!searchTerm.trim()) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(lower));
  };

  const toggleBookmark = (id) => {
    setBookmarks(prev => 
      prev.includes(id) 
        ? prev.filter(bookmarkId => bookmarkId !== id)
        : [...prev, id]
    );
  };

  const isBookmarked = (id) => {
    return bookmarks.includes(id);
  };

  const getBookmarkedItems = () => {
    return bookmarks
      .map(id => findItemById(data, id))
      .filter(item => item !== null);
  };

  const itemsToShow = showBookmarks 
    ? filterItems(getBookmarkedItems()) 
    : currentFolder.children 
      ? filterItems(currentFolder.children) 
      : [];

  const openFile = async (item) => {
    if (item.type === 'note') {
      setNoteContent(item.content || '');
      setPreviewFile(item);
      return;
    }
    
    if (item.type !== 'file') return;
    const ext = item.name.split('.').pop().toLowerCase();

    if (item.preview) {
      setPreviewContent('');
      setPreviewFile(item);
      return;
    }

    if (ext === 'docx') {
      setPreviewContent('');
      setPreviewFile(item);
      return;
    }

    if (textFileExtensions.includes(ext)) {
      try {
        const text = await item.file.text();
        setPreviewContent(text);
        setPreviewFile(item);
      } catch {
        setPreviewContent('Не удалось прочитать файл');
        setPreviewFile(item);
      }
      return;
    }

    if (ext === 'pdf') {
      setPreviewContent('');
      setPreviewFile(item);
      return;
    }

    if (unsupportedPreviewExtensions.includes(ext)) {
      setPreviewContent('');
      setPreviewFile(item);
      return;
    }

    setPreviewContent('');
    setPreviewFile(item);
  };

  const closePreview = () => {
    if (previewFile && previewFile.type === 'note' && noteContent !== previewFile.content) {
      const updatedData = {...data};
      const updateNoteContent = (folder) => {
        if (folder.children) {
          for (const child of folder.children) {
            if (child.id === previewFile.id) {
              child.content = noteContent;
              child.updatedAt = new Date().toISOString();
              return true;
            }
            if (child.type === 'folder' && updateNoteContent(child)) {
              return true;
            }
          }
        }
        return false;
      };
      updateNoteContent(updatedData);
      setData(updatedData);
    }
    
    setPreviewFile(null);
    setPreviewContent('');
    setNoteContent('');
  };

  const saveNote = () => {
    if (!previewFile) return;
    
    const updatedData = {...data};
    const updateNoteContent = (folder) => {
      if (folder.children) {
        for (const child of folder.children) {
          if (child.id === previewFile.id) {
            child.content = noteContent;
            child.updatedAt = new Date().toISOString();
            return true;
          }
          if (child.type === 'folder' && updateNoteContent(child)) {
            return true;
          }
        }
      }
      return false;
    };
    
    if (updateNoteContent(updatedData)) {
      setData(updatedData);
      setPreviewFile({...previewFile, content: noteContent, updatedAt: new Date().toISOString()});
      alert('Заметка сохранена!');
    }
  };

  return (
    <>
      <style>{`
        /* --- Стили для файлового менеджера --- */
        * {
          box-sizing: border-box;
        }
        body {
          background: ${darkMode ? '#1a1a1a' : '#f5f7fa'};
          margin: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: ${darkMode ? '#e0e0e0' : '#333'};
          transition: background-color 0.3s ease, color 0.3s ease;
        }
        button {
          transition: background-color 0.3s ease, color 0.3s ease;
          user-select: none;
        }
        button:hover {
          background-color: #0056b3;
          color: white;
        }
        input[type="text"], input[type="search"], textarea {
          border: 1px solid ${darkMode ? '#555' : '#ccc'};
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.3s ease;
          background-color: ${darkMode ? '#333' : 'white'};
          color: ${darkMode ? '#e0e0e0' : '#333'};
        }
        input[type="text"]:focus, input[type="search"]:focus, textarea:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 6px #a0c8ff;
        }
        ul {
          list-style: none;
          padding-left: 0;
          margin: 0;
        }
        li {
          padding: 10px 15px;
          border-bottom: 1px solid ${darkMode ? '#444' : '#ddd'};
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          background-color: ${darkMode ? '#2d2d2d' : 'white'};
          border-radius: 6px;
          margin-bottom: 8px;
          box-shadow: 0 2px 6px rgb(0 0 0 / 0.05);
          transition: background-color 0.2s ease;
        }
        li:hover {
          background-color: ${darkMode ? '#3a3a3a' : '#e9f0ff'};
        }
        li span {
          user-select: none;
          flex-grow: 1;
          font-size: 16px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        li input[type="text"] {
          font-size: 16px;
          padding: 6px 8px;
          border-radius: 6px;
          border: 1px solid ${darkMode ? '#555' : '#bbb'};
          width: 100%;
          background-color: ${darkMode ? '#333' : 'white'};
          color: ${darkMode ? '#e0e0e0' : '#333'};
        }
        li button {
          background: transparent;
          border: none;
          color: #ff4d4f;
          font-size: 18px;
          cursor: pointer;
          padding: 0 6px;
        }
        li button:hover {
          color: #d9363e;
        }
        nav button {
          background: none;
          border: none;
          color: #007bff;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          margin-right: 5px;
        }
        nav button:hover {
          text-decoration: underline;
        }
        nav button:last-child {
          color: ${darkMode ? '#e0e0e0' : '#333'};
          font-weight: 700;
          cursor: default;
          text-decoration: none;
        }
        nav button:last-child:hover {
          text-decoration: none;
        }
        .docx-viewer {
          overflow-y: auto;
          max-height: 80vh;
          padding: 10px;
          border: 1px solid ${darkMode ? '#555' : '#ccc'};
          border-radius: 8px;
          background-color: ${darkMode ? '#2d2d2d' : '#fff'};
          font-size: 16px;
          line-height: 1.5;
          color: ${darkMode ? '#e0e0e0' : '#333'};
        }
        .modal-overlay {
          position: fixed;
          top: 30px;
          left: 30px;
          right: 30px;
          bottom: 30px;
          background-color: rgba(0,0,0,0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .modal-content {
          background-color: ${darkMode ? '#2d2d2d' : 'white'};
          border-radius: 10px;
          max-width: 90%;
          max-height: 90%;
          padding: 20px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          position: relative;
          width: 80%;
          height: 80%;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          color: ${darkMode ? '#e0e0e0' : '#333'};
        }
        .modal-close-button {
          position: absolute;
          top: 10px;
          right: 10px;
          border: none;
          background: transparent;
          font-size: 24px;
          cursor: pointer;
          color: ${darkMode ? '#e0e0e0' : '#333'};
        }
        .preview-image {
          max-width: 100%;
          max-height: 100%;
          border-radius: 8px;
          object-fit: contain;
        }
        pre {
          white-space: pre-wrap;
          word-wrap: break-word;
          font-size: 16px;
          line-height: 1.4;
          background-color: ${darkMode ? '#333' : '#f0f0f0'};
          padding: 15px;
          border-radius: 6px;
          height: 100%;
          overflow-y: auto;
          margin: 0;
          font-family: Consolas, monospace;
          color: ${darkMode ? '#e0e0e0' : '#333'};
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
          border-radius: 8px;
          background-color: white;
        }
        .download-link {
          margin-top: 15px;
          padding: 12px 18px;
          background-color: #007bff;
          color: white;
          border-radius: 6px;
          text-decoration: none;
          align-self: flex-start;
          font-size: 16px;
          user-select: none;
          box-shadow: 0 4px 10px rgba(0,123,255,0.3);
          transition: background-color 0.3s ease;
        }
        .download-link:hover {
          background-color: #0056b3;
          box-shadow: 0 6px 12px rgba(0,86,179,0.5);
        }
        .note-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .note-textarea {
          flex-grow: 1;
          padding: 15px;
          font-size: 16px;
          line-height: 1.5;
          resize: none;
          margin-bottom: 15px;
          border: 1px solid ${darkMode ? '#555' : '#ddd'};
          border-radius: 8px;
          background-color: ${darkMode ? '#333' : 'white'};
          color: ${darkMode ? '#e0e0e0' : '#333'};
        }
        .note-meta {
          font-size: 14px;
          color: ${darkMode ? '#aaa' : '#666'};
          margin-bottom: 10px;
        }
        .note-actions {
          display: flex;
          gap: 10px;
        }
        .note-save-button {
          padding: 10px 20px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }
        .note-save-button:hover {
          background-color: #218838;
        }
        .note-cancel-button {
          padding: 10px 20px;
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }
        .note-cancel-button:hover {
          background-color: #c82333;
        }
        .note-icon {
          margin-right: 8px;
          color: #ffc107;
        }
        .theme-toggle {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 8px 16px;
          background-color: ${darkMode ? '#444' : '#ddd'};
          color: ${darkMode ? '#fff' : '#333'};
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 100;
        }
        .bookmarks-toggle {
          position: fixed;
          top: 20px;
          right: 150px;
          padding: 8px 16px;
          background-color: ${darkMode ? '#444' : '#ddd'};
          color: ${darkMode ? '#fff' : '#333'};
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 100;
        }
        .bookmark-button {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 0 6px;
          color: ${darkMode ? '#ffc107' : '#ffc107'};
        }
        .bookmark-button.active {
          color: #ffc107;
        }
        .bookmark-button:not(.active) {
          color: ${darkMode ? '#555' : '#ccc'};
        }
      `}</style>

      <button 
        className="theme-toggle" 
        onClick={() => setDarkMode(!darkMode)}
        title={darkMode ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
      >
        {darkMode ? '☀️ Светлая тема' : '🌙 Темная тема'}
      </button>

      <button 
        className="bookmarks-toggle" 
        onClick={() => {
          setShowBookmarks(!showBookmarks);
          if (!showBookmarks) {
            setCurrentFolderId('root');
            setPath(['root']);
          }
        }}
        title={showBookmarks ? 'Показать текущую папку' : 'Показать закладки'}
      >
        {showBookmarks ? '📂 Показать папку' : '🔖 Показать закладки'}
      </button>

      <div style={{ maxWidth: 700, margin: 'auto', padding: 20 }}>
        <h1>🚀 Файловый менеджер на React</h1>

        {showBookmarks ? (
          <h2>🔖 Закладки</h2>
        ) : (
          <nav style={{ marginBottom: 10 }}>
            {path.map((id, idx) => {
              const folder = findFolderById(data, id);
              return (
                <button
                  key={id}
                  onClick={() => goBack(idx)}
                  style={{
                    color: idx === path.length -1 ? (darkMode ? '#e0e0e0' : '#333') : '#007bff',
                    fontWeight: idx === path.length - 1 ? '700' : '600',
                    cursor: idx === path.length -1 ? 'default' : 'pointer',
                    marginRight: 5,
                    background: 'none',
                    border: 'none',
                  }}
                  disabled={idx === path.length -1}
                >
                  {folder.name}
                  {idx < path.length - 1 && ' / '}
                </button>
              );
            })}
          </nav>
        )}

        {!showBookmarks && (
          <div style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
            <input
              type="text"
              placeholder="Название новой папки/заметки"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if(e.key === 'Enter') handleAddFolder();
              }}
              style={{
                flexGrow: 1,
                padding: 10,
                borderRadius: 6,
                border: `1px solid ${darkMode ? '#555' : '#ccc'}`,
                fontSize: 16,
                backgroundColor: darkMode ? '#333' : 'white',
                color: darkMode ? '#e0e0e0' : '#333',
              }}
            />
            <button onClick={handleAddFolder} style={{
              padding: '10px 20px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#28a745',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'background-color 0.3s ease',
            }}>+ Папка</button>
            <button onClick={handleAddNote} style={{
              padding: '10px 20px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#ffc107',
              color: 'black',
              fontWeight: '600',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'background-color 0.3s ease',
            }}>+ Заметка</button>
            <button onClick={() => fileInputRef.current.click()} style={{
              padding: '10px 20px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#007bff',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'background-color 0.3s ease',
            }}>+ Файл</button>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              multiple
              onChange={e => {
                handleAddFiles(e.target.files);
                e.target.value = null;
              }}
            />
          </div>
        )}

        <input
          type="search"
          placeholder={showBookmarks ? "Поиск в закладках..." : "Поиск файлов и папок..."}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: 10,
            marginBottom: 20,
            borderRadius: 6,
            border: `1px solid ${darkMode ? '#555' : '#ccc'}`,
            fontSize: 16,
            backgroundColor: darkMode ? '#333' : 'white',
            color: darkMode ? '#e0e0e0' : '#333',
          }}
        />

        <ul>
          {itemsToShow.length === 0 && (
            <li style={{ justifyContent: 'center', cursor: 'default' }}>
              {showBookmarks ? 'Нет закладок' : 'Нет файлов или папок'}
            </li>
          )}
          {itemsToShow.map(item => (
            <li key={item.id} onDoubleClick={() => item.type === 'folder' && !showBookmarks ? goToFolder(item.id) : openFile(item)} 
                title={item.type === 'folder' && !showBookmarks ? "Двойной клик для открытия" : ""}>
              {editingId === item.id ? (
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onBlur={() => finishRenaming(item.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') finishRenaming(item.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  style={{
                    backgroundColor: darkMode ? '#333' : 'white',
                    color: darkMode ? '#e0e0e0' : '#333',
                  }}
                />
              ) : (
                <span>
                  {item.type === 'note' && <span className="note-icon">📝</span>}
                  {item.name}
                </span>
              )}
              <div style={{ display: 'flex', gap: 8, marginLeft: 10 }}>
                <button
                  className={`bookmark-button ${isBookmarked(item.id) ? 'active' : ''}`}
                  title={isBookmarked(item.id) ? "Удалить из закладок" : "Добавить в закладки"}
                  onClick={e => {
                    e.stopPropagation();
                    toggleBookmark(item.id);
                  }}
                >
                  {isBookmarked(item.id) ? '⭐' : '☆'}
                </button>
                <button
                  title="Переименовать"
                  onClick={e => {
                    e.stopPropagation();
                    startRenaming(item.id, item.name);
                  }}
                >
                  ✏️
                </button>
                <button
                  title="Удалить"
                  onClick={e => {
                    e.stopPropagation();
                    if(window.confirm(`Удалить "${item.name}"?`)) deleteItem(item.id);
                  }}
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>

        {previewFile && (
          <div className="modal-overlay" onClick={closePreview}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <button className="modal-close-button" onClick={closePreview} title="Закрыть">×</button>

              {previewFile.preview && (
                <img className="preview-image" src={previewFile.preview} alt={previewFile.name} />
              )}

              {previewFile.name.toLowerCase().endsWith('.docx') && (
                <DocxViewer file={previewFile.file} />
              )}

              {textFileExtensions.some(ext => previewFile.name.toLowerCase().endsWith(ext)) && previewContent && (
                <pre>{previewContent}</pre>
              )}

              {previewFile.name.toLowerCase().endsWith('.pdf') && (
                <iframe
                  title={previewFile.name}
                  src={URL.createObjectURL(previewFile.file)}
                />
              )}

              {previewFile.type === 'note' && (
                <div className="note-editor">
                  <h2>{previewFile.name}</h2>
                  <div className="note-meta">
                    Создано: {new Date(previewFile.createdAt).toLocaleString()} | 
                    Изменено: {new Date(previewFile.updatedAt).toLocaleString()}
                  </div>
                  <textarea
                    className="note-textarea"
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Введите текст заметки..."
                  />
                  <div className="note-actions">
                    <button className="note-save-button" onClick={saveNote}>
                      Сохранить
                    </button>
                    <button className="note-cancel-button" onClick={closePreview}>
                      Закрыть
                    </button>
                  </div>
                </div>
              )}

              {unsupportedPreviewExtensions.some(ext => previewFile.name.toLowerCase().endsWith(ext)) && (
                <>
                  <p>Превью для данного типа файла не поддерживается.</p>
                  <a
                    href={URL.createObjectURL(previewFile.file)}
                    download={previewFile.name}
                    className="download-link"
                  >
                    Скачать файл
                  </a>
                </>
              )}

              {!previewFile.preview && !previewContent && !previewFile.name.toLowerCase().endsWith('.pdf') &&
                !previewFile.name.toLowerCase().endsWith('.docx') && !unsupportedPreviewExtensions.some(ext => previewFile.name.toLowerCase().endsWith(ext)) &&
                previewFile.type !== 'note' && (
                <>
                  <p>Превью для данного типа файла не поддерживается.</p>
                  <a
                    href={URL.createObjectURL(previewFile.file)}
                    download={previewFile.name}
                    className="download-link"
                  >
                    Скачать файл
                  </a>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
