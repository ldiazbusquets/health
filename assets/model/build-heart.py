import json, gzip, struct, sys, re, numpy as np
base = sys.argv[1]; out = sys.argv[2]
a = json.load(open(base + '/public/models/atlas.json'))
chunks = {}
def chunk(i):
    if i not in chunks: chunks[i] = gzip.open(f'{base}/public/models/body-{i}.bin.gz').read()
    return chunks[i]
def group(name):
    n = name.lower()
    if 'wall of' in n: return 0
    if re.search(r'vein|vena cava|sinus', n): return 2
    return 1
want = []
for p in a['parts']:
    n = p['name'].lower(); c = p['chunk']
    if c == 8 and n.startswith('wall of'): want.append(p)
    elif c == 9 and re.search(r'coronary|cardiac vein|interventricular (vein|branch|artery)|ventricular branch|marginal branch|septal branch|conus branch|diagonal branch|circumflex', n): want.append(p)
    elif c == 11 and re.search(r'pulmonary (trunk|artery|vein)', n): want.append(p)
    elif re.search(r'^(arch of aorta|ascending aorta|brachiocephalic artery|left common carotid artery|left subclavian artery|superior vena cava|descending thoracic aorta)$', n): want.append(p)
print(len(want), 'parts')
# heart-centred box; vessels are cut where they leave it
lo = np.array([-0.07, 1.247, -0.062]); hi = np.array([0.095, 1.438, 0.085])
def clip(pos, nrm, idx, planes):
    # exact Sutherland-Hodgman clipping of each triangle against half-spaces, so vessels end in clean rings
    pos = list(map(tuple, pos)); nrm = list(map(tuple, nrm)); tris = [tuple(t) for t in idx]
    for ax, op, val in planes:
        sgn = 1 if op == '<' else -1
        d = lambda i: sgn * (pos[i][ax] - val)   # <= 0 keeps
        out = []; cache = {}
        def mid(i, j):
            k = (min(i, j), max(i, j))
            if k in cache: return cache[k]
            di, dj = d(i), d(j); t = di / (di - dj)
            pos.append(tuple(pos[i][c] + (pos[j][c] - pos[i][c]) * t for c in range(3)))
            nrm.append(tuple(nrm[i][c] + (nrm[j][c] - nrm[i][c]) * t for c in range(3)))
            cache[k] = len(pos) - 1; return cache[k]
        for t in tris:
            ins = [d(i) <= 0 for i in t]
            if all(ins): out.append(t); continue
            if not any(ins): continue
            poly = []
            for a_ in range(3):
                i, j = t[a_], t[(a_ + 1) % 3]
                if ins[a_]: poly.append(i)
                if ins[a_] != ins[(a_ + 1) % 3]: poly.append(mid(i, j))
            for k in range(1, len(poly) - 1): out.append((poly[0], poly[k], poly[k + 1]))
        tris = out
    return np.array(pos), np.array(nrm), np.array(tris, dtype=np.int64).reshape(-1, 3)

P, N, G, I = [], [], [], []; off = 0
for p in want:
    b = chunk(p['chunk']); v = p['vertexCount']
    pos = np.frombuffer(b, np.float32, v * 3, p['positions']).reshape(-1, 3)
    nrm = np.frombuffer(b, np.int16, v * 3, p['normals']).reshape(-1, 3)
    idx = np.frombuffer(b, np.uint32, p['indexCount'], p['indices']).reshape(-1, 3)
    nm = p['name'].lower()
    planes = [(0, '>', lo[0]), (0, '<', hi[0]), (1, '>', lo[1]), (1, '<', hi[1]), (2, '>', lo[2]), (2, '<', hi[2])]
    if 'pulmonary artery' in nm: planes += [(0, '>', -0.022), (0, '<', 0.066)]
    if 'pulmonary vein' in nm: planes += [(0, '>', -0.026), (0, '<', 0.068)]
    if 'subclavian' in nm: planes += [(0, '<', 0.04)]
    if 'carotid' in nm or 'brachiocephalic' in nm: planes += [(1, '<', 1.418)]
    if 'descending' in nm: planes += [(1, '>', 1.335)]
    pos, nrm, idx = clip(pos.astype(np.float64), nrm.astype(np.float64), idx.astype(np.int64), planes)
    keep = np.ones(len(idx), bool)
    idx = idx[keep]
    if not len(idx): continue
    used = np.unique(idx); remap = -np.ones(len(pos), np.int64); remap[used] = np.arange(len(used))
    P.append(pos[used]); N.append(nrm[used]); G.append(np.full(len(used), group(p['name']), np.uint8)); I.append(remap[idx] + off); off += len(used)
P = np.concatenate(P); N = np.concatenate(N).astype(np.float32); G = np.concatenate(G); I = np.concatenate(I).astype(np.uint32); assert len(P) < 65536; I = I.astype(np.uint16)
print('verts', len(P), 'tris', len(I))
T = I.reshape(-1, 3).astype(np.int64)
fn = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
key = np.round(P / 2e-4).astype(np.int64); _, weld = np.unique(key, axis=0, return_inverse=True); weld = weld.ravel()
acc = np.zeros((weld.max() + 1, 3)); 
for k in range(3): np.add.at(acc, weld[T[:, k]], fn)
vn = acc[weld]; ln = np.linalg.norm(vn, axis=1, keepdims=True); orig = N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-9)
vn = np.where(ln > 1e-12, vn / (ln + 1e-12), orig)
# keep the original direction sense (outward)
flip = (vn * orig).sum(1) < 0; vn[flip] *= -1
N = vn * 32767
# centre on the ventricles and orient: y up, apex down; scale to unit height
c = (P.min(0) + P.max(0)) / 2; P = P - c; s = (P.max(0) - P.min(0)).max(); P = P / s
bmin = P.min(0); bmax = P.max(0)
q = np.round((P - bmin) / (bmax - bmin) * 65535).astype(np.uint16)
n8 = np.clip(np.round(N.astype(np.float32) / 32767 * 127), -127, 127).astype(np.int8)
with open(out, 'wb') as f:
    f.write(struct.pack('<4sII6f', b'HRT1', len(P), I.size, *bmin, *bmax))
    f.write(q.tobytes()); f.write(n8.tobytes())
    f.write(G.tobytes()); f.write(b'\0' * ((2 - (len(P) * 10) % 2) % 2))
    f.write(I.tobytes())
import os; print('bytes', os.path.getsize(out), 'groups', np.bincount(G))
