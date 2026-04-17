# Day 2 Quick Start Testing Guide

**Date**: April 14, 2026 | **Your copy of ✅ Implementation ready to test**

---

## 🚀 Quick Start (5 minutes)

### 1. Start Services
```bash
cd /home/growlt378/Desktop/Final\ Evaluation
docker-compose up
```

**Wait for output:**
```
✓ postgres: healthy
✓ backend: migrations complete
✓ frontend: vite ready
```

### 2. Open Browser
```
http://localhost:5173
```

### 3. Login (Or create account)
```
Email: test@example.com
Password: Password123
```

---

## ✅ Testing Checklist

### Test 1: Create Document
- [ ] Click "New document" button
- [ ] Document should appear in list
- [ ] Click document title to open editor

### Test 2: Editor Opens
- [ ] Document name appears in header
- [ ] One paragraph block visible (empty)
- [ ] Block is clickable
- [ ] Cursor appears on click

### Test 3: Type Text
- [ ] Type "Hello World"
- [ ] Text appears in block
- [ ] Text is saved (check after 500ms debounce)

### Test 4: CRITICAL - Enter Key Split
```
Start: "Hello World" block (cursor after "Hello")
       "Hello| World"
            ↑

Press: Enter key

Expected:
  Block 1: "Hello"
  Block 2: " World"
  
Cursor: At start of Block 2 (before space)
```

**Verify:**
- [ ] Two blocks appear
- [ ] Top block: "Hello"
- [ ] Bottom block: " World"
- [ ] NO text loss
- [ ] Cursor at start of bottom block
- [ ] Pressing Enter again creates Block 3

### Test 5: Enter at End of Block
```
Start: "Hello" block (cursor at end)
       "Hello|"
             ↑

Press: Enter key

Expected:
  Block 1: "Hello"
  Block 2: "" (empty)
  
Cursor: In Block 2
```

**Verify:**
- [ ] New empty block created below
- [ ] Cursor in new block
- [ ] Can type in new block

### Test 6: CRITICAL - Backspace Merge
```
Setup:
  Block 1: "Hello"
  Block 2: "World" (cursor at start)
           "|World"
           ↑

Press: Backspace key

Expected:
  Block 1: "HelloWorld" (merged)
  Block 2: Deleted
  
Cursor: After "Hello" (position 5)
```

**Verify:**
- [ ] Blocks merged into one
- [ ] Text: "HelloWorld"
- [ ] Cursor between "Hello" and "World"
- [ ] Can continue typing

### Test 7: Backspace at First Block
```
Setup:
  Block 1: "Hello" (cursor at start)
           "|Hello"
           ↑

Press: Backspace key

Expected:
  Nothing happens (safe behavior)
  Block still: "Hello"
```

**Verify:**
- [ ] No crash
- [ ] Block unchanged
- [ ] Cursor still at start

### Test 8: Slash Command Menu
```
Setup:
  Empty block
  
Press: / key

Expected:
  Menu appears showing:
  - Paragraph
  - Heading 1
  - Heading 2
  - To-do
  - Code
  - Divider
  - Image
```

**Verify:**
- [ ] Menu appears
- [ ] Shows all 7 types
- [ ] Menu has keyboard hints
- [ ] Can navigate with arrow keys

### Test 9: Slash Menu Filtering
```
Setup:
  Slash menu open
  
Type: hea (after the "/")

Expected:
  Menu filters to:
  - Heading 1
  - Heading 2
```

**Verify:**
- [ ] Menu filters while typing
- [ ] Only matching items show
- [ ] "/" not persisted in block

### Test 10: Select Block Type via Slash
```
Setup:
  Slash menu showing "Heading 1" selected (arrow keys)
  
Press: Enter key

Expected:
  Current block becomes Heading 1
  Block content cleared
  Heading 1 styling applied
```

**Verify:**
- [ ] Block type changed to H1
- [ ] Larger text visible
- [ ] Bold formatting visible
- [ ] Can type in heading
- [ ] Menu closed

### Test 11: Code Block Tab Handling
```
Setup:
  Create code block (use "/" slash menu)
  
Actual block editing:
Press: Tab key

Expected:
  2 spaces inserted at cursor
  Cursor moves 2 positions right
  No focus change
```

**Verify:**
- [ ] 2 spaces inserted (not tab char)
- [ ] Cursor position correct
- [ ] Focus stays in block
- [ ] Can continue typing

### Test 12: Todo Block
```
Setup:
  Create Todo block (use "/" slash menu)
  
Test: Click checkbox

Expected:
  Checkbox toggles
  Text remains
```

**Verify:**
- [ ] Checkbox appears
- [ ] Text input next to checkbox
- [ ] Checkbox state toggles
- [ ] State persists

### Test 13: Image Block
```
Setup:
  Create Image block (use "/" slash menu)
  
Action: Enter image URL

URL: https://via.placeholder.com/300x200

Expected:
  Image preview appears below input
```

**Verify:**
- [ ] URL input field visible
- [ ] Image shows when URL entered
- [ ] Image is responsive
- [ ] URL persists

### Test 14: Divider Block
```
Setup:
  Create Divider block (use "/" slash menu)
  
Expected:
  Horizontal line appears
  Non-editable
```

**Verify:**
- [ ] Horizontal line renders
- [ ] Cannot type in it
- [ ] Cannot merge with divider

### Test 15: Switch Block Types
```
Setup:
  Paragraph block with text "Hello"
  
Action:
  Press "/" menu
  Select "Code"

Expected:
  Block type changes to Code
  Text "Hello" appears in monospace
```

**Verify:**
- [ ] Type changed
- [ ] Styling applied
- [ ] Content visible
- [ ] Can edit in new type

### Test 16: Persistence (Reload)
```
Setup:
  Create multi-block document
  Blocks: Heading, Paragraph, Code

Action:
  Reload page (F5)

Expected:
  All blocks reappear in same order
  Content preserved
  Block types preserved
```

**Verify:**
- [ ] Blocks load from backend
- [ ] Order preserved
- [ ] Content correct
- [ ] Types correct

### Test 17: Multiple Documents
```
Setup:
  Create Document 1
  Create Document 2
  Edit Document 1
  Go back to dashboard
  Click Document 2

Expected:
  Document 2 opens in editor
  Blocks are Document 2's blocks
  No cross-document mixed content
```

**Verify:**
- [ ] Navigation works
- [ ] Correct document loads
- [ ] No data mixed up
- [ ] Each document independent

### Test 18: Back Button
```
Setup:
  In editor
  
Action:
  Click "← Back to documents" button

Expected:
  Return to dashboard
  Document list visible
```

**Verify:**
- [ ] Navigation works
- [ ] Dashboard loads
- [ ] Document list visible

### Test 19: Cursor Position After Multiple Operations
```
Setup:
  Block: "Hello World"
  
Sequence:
  1. Click after "H" (position 1)
  2. Press Enter → ["H", "ello World"]
  3. In Block 2, click after "e" (position 1)
  4. Press Enter → ["H", "e", "llo World"]
  5. Backspace in Block 3 → ["H", "ello World"]
  
Expected:
  Cursor always at logical position
  No skips or jumps
```

**Verify:**
- [ ] Each operation works
- [ ] Cursor position correct each time
- [ ] No cursor jumps
- [ ] Text preserved

### Test 20: Error Cases (Should not crash)
- [ ] Delete all blocks then refresh
- [ ] Type very long text (1000+ chars)
- [ ] Rapid Enter/Backspace clicks
- [ ] Slash menu escape key
- [ ] Network delay (dev tools throttle)

**Verify:**
- [ ] No JavaScript errors in console
- [ ] Graceful handling
- [ ] UI remains responsive

---

## 🔍 Debugging Tips

### Check Block Content in Browser DevTools
```javascript
// In console:
// Get all blocks
fetch('/api/blocks/documents/YOUR_DOC_ID/blocks')
  .then(r => r.json())
  .then(d => console.log(d.blocks))

// View individual block
document.querySelector('[data-block-id="BLOCK_ID"]')
```

### Check Block Editor State
```javascript
// In React DevTools
// Find BlockEditor component
// View state: blocks, selectedBlockId, slashMenuBlockId
```

### Network Tab
```
Watch these requests:
GET  /blocks/documents/{id}/blocks      (loading)
PATCH /blocks/{id}                      (saving content)
POST  /blocks                           (creating)
DELETE /blocks/{id}                     (deleting)
```

---

## ⚠️ If Something Goes Wrong

### Blocks Not Loading
```bash
# Check backend logs
docker-compose logs backend

# Verify database has blocks table
docker-compose exec postgres psql -U postgres -d blocknote -c "SELECT COUNT(*) FROM blocks;"
```

### Content Not Saving
```bash
# Check DevTools Network tab
# Look for PATCH /blocks/{id} requests
# Should see 200 status
```

### Slash Menu Not Appearing
```javascript
// In console, check key event
// Should trigger on "/" at position 0
```

### Cursor Position Wrong
```javascript
// Check if cursor position calculation is running
// In Block component, verify getCursorPosition() returns correct number
```

---

## ✅ Success Criteria

After testing all 20 tests:

```
✓ All Enter key splits work without text loss
✓ All Backspace merges work correctly
✓ First block backspace is safe (no crash)
✓ Slash menu appears and filters correctly
✓ Block type switching works
✓ Tab in code block inserts 2 spaces
✓ Todo checkbox toggles
✓ Image preview loads
✓ Divider renders
✓ Content persists on reload
✓ Multiple documents work independently
✓ Cursor position maintained through operations
✓ No JavaScript errors in console
✓ No breaking changes to Day 1 features
✓ Dashboard still works (documents list)
✓ Auth still works (login/logout)
```

**All 20 tests passing = Production ready** ✅

---

## 📊 Expected Performance

- Load blocks: < 200ms
- Save content: < 500ms (debounced)
- Enter key response: < 50ms
- Backspace response: < 50ms
- Slash menu open: < 100ms
- Block type switch: < 200ms

---

## 🎯 When Ready for Production

- [ ] All 20 tests pass
- [ ] No console errors
- [ ] No performance issues
- [ ] Handle network latency (test with DevTools throttling)
- [ ] Mobile responsive (test on phone)
- [ ] Accessibility (test with keyboard only)

---

**Ready to test!** 🚀

Are you able to run the tests? Let me know if you encounter any issues.
