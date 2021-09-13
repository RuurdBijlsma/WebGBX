document.addEventListener('DOMContentLoaded', init, false)

async function loadFileBuffer(file) {
    return new Promise(async resolve => {

        // let response = await fetch('data/map.Gbx')
        // let response = await fetch('data/ghost.gbx')
        let response = await fetch(file)
        let blob = await response.blob()

        let reader = new FileReader()
        reader.readAsArrayBuffer(blob)
        reader.onload = () => {
            resolve(reader.result);
        }
    });
}

// todo:
// Fix lookback strings
// i have testcase now with the first chunk from map.Gbx

async function init() {
    // let buffer = await loadFileBuffer('data/map.Gbx')
    // let buffer = await loadFileBuffer('data/ghost.gbx')
    let buffer = await loadFileBuffer('data/boing.Ghost.gbx');
    const reader = new ViewReader(buffer)

    let magic = reader.readStringOfLength(3)
    console.log({ magic })

    let version = reader.readUInt16()
    if (version < 6)
        console.error("Version not supported")
    console.log({ version })

    let byteFormat = reader.readStringOfLength(1)
    console.log({ byteFormat })

    let refCompression = reader.readStringOfLength(1)
    console.log({ refCompression })

    let bodyCompression = reader.readStringOfLength(1)
    console.log({ bodyCompression })

    let rORe = reader.readStringOfLength(1)
    console.log({ rORe })

    let classId = reader.readUInt32()
    console.log({ classId })

    let userDataSize = reader.readUInt32()
    console.log({ userDataSize })

    if (userDataSize > 0) {
        // let userDataArray = uint8.slice(pos, pos + userDataSize)
        // console.log({ userDataArray })

        // let userDataView = new DataView(userDataArray.buffer)
        let numHeaderChunks = reader.readUInt32()
        console.log({ numHeaderChunks })

        let chunks = []
        for (let i = 0; i < numHeaderChunks; i++) {
            let chunkId = reader.readUInt32()
            let chunkSize = reader.readInt32()
            let isHeavy = chunkSize < 0;
            if (isHeavy)
                chunkSize += 2 ** 31;
            chunks.push({ index: i, isHeavy, id: chunkId, size: chunkSize, data: null })
        }
        for (let chunk of chunks) {
            chunk.data = reader.readBytes(chunk.size)
        }
        console.log(chunks);
    }

    let numNodes = reader.readUInt32()
    console.log({ numNodes })

    let numExternalNodes = reader.readUInt32()
    console.log({ numExternalNodes })

    if (numExternalNodes > 0) {
        console.error("External nodes not yet implemented");
    }

    let bodyData;
    if (bodyCompression === 'C') {
        let uncompressedBodySize = reader.readUInt32()
        console.log({ uncompressedBodySize })
        let compressedBodySize = reader.readUInt32()
        console.log({ compressedBodySize })
        bodyData = reader.readBytes(compressedBodySize)
    } else {
        console.warn('uncompressed body detected, this is not supported');
    }

    let state = {
        inputBuffer: bodyData,
        outputBuffer: null,
    };
    let lzoResult = lzo1x.decompress(state);
    if (lzoResult !== 0)
        console.warn("Failed to decompress body")
    let body = state.outputBuffer;
    readBody(body)
}

function readBody(body) {
    let reader = new ViewReader(body.buffer)
    console.log({ reader, body, bodyString: reader.toUtf8(body) })
    const skipCode = 0x534B4950;
    const nullChunk = 0xfacade01;
    while (true) {
        let chunkId = reader.readUInt32()
        console.warn({ chunkId: chunkId.toString(16) })
        if (chunkId === 0xFACADE01) // no more chunks
        {
            console.log('FACADE01 Found')
            reader.resetLookback()
            skipToNextChunk(reader)
            continue
            // return;
        }

        let chunkFlags = chunkMap[chunkId] ?? null;
        console.log(chunkFlags)

        // skip chunk if it's unknown or skippable and not needing to be read:
        if (chunkFlags === null || (chunkFlags.skippable && chunkFlags.read === false)) {
            let skip = reader.readUInt32()
            console.log({ skip: skip.toString(16) })
            if (skip !== 0x534B4950) // "SKIP"
            {
                skipToNextChunk(reader)
                continue
            }

            console.log('skipping chunk', chunkId)
            let chunkDataSize = reader.readUInt32()
            console.log({ chunkDataSize })
            // skip chunk
            reader.skip(chunkDataSize)
        } else { // if the chunk is not skippable or it needs to be read:
            if (chunkFlags.skippable) {  // ignore skip info if its there
                let skip = reader.readUInt32()
                console.log('unused', { skip })

                let chunkDataSize = reader.readUInt32()
                console.log('unused', { chunkDataSize })
            }

            readChunk(reader, chunkId); // read the chunk
        }
    }
}

function skipToNextChunk(reader) {
    console.warn("Skipping to next chunk")
    let skipped = 0
    while (true) {
        skipped++
        let id = reader.readUInt32()
        reader.skip(-3)
        if (chunkMap.hasOwnProperty(id)) {
            console.log('chunk found after skipping', skipped, 'bytes', id.toString(16))
            reader.skip(-1)
            break
        }
    }
}

function readChunk(reader, chunkId) {
    console.log('reading chunk', chunkId.toString(16));
    if (chunkId === 0x0304300d) {
        console.log(reader.readMeta())
    }
    if (chunkId === 0x0303f006) {
        let isReplaying = reader.readUInt32()
        console.log({ isReplaying })
        let rest = readChunk(reader, 0x0303F005)
        console.log({ rest })
    }
    if (chunkId === 0x0303F005) {
        let uncompressedSize = reader.readUInt32()
        let compressedSize = reader.readUInt32()
        let compressedBytes = reader.readBytes(compressedSize)
        console.log({ uncompressedSize, compressedSize, compressedBytes })
        return { uncompressedSize, compressedSize, compressedBytes }
    }
    if (chunkId === 0x03092000) {
        let x = reader.readUInt32()
        let playerModel = reader.readMeta()
        let y = reader.readVec3()
        let numSkinRef = reader.readUInt32()
        let skinRefs = []
        for (let i = 0; i < numSkinRef; i++)
            skinRefs.push(reader.readFileRef())
        let z = reader.readUInt32()
        let ghostNickname = reader.readString()
        let ghostAvatarFile = reader.readString()
        let xx = reader.readUInt32()
        console.log({ x, playerModel, y, skinRefs, z, ghostNickname, ghostAvatarFile, xx })
        skipToNextChunk(reader)
    }
    if (chunkId === 0x0309200b) {
        let numCheckpoints = reader.readUInt32()
        let checkpoints = []
        for (let i = 0; i < numCheckpoints; i++) {
            checkpoints.push({
                time: reader.readUInt32(),
                stuntsScore: reader.readUInt32(),
            })
        }
        console.log({ numCheckpoints, checkpoints })
    }
    if (chunkId === 0x0309200c) {
        let ignored = reader.readUInt32();
        console.log({ ignored })
    }
    if (chunkId === 0x0309200E) {
        let uid = reader.readLookbackString()
        console.log({ uid })
        skipToNextChunk(reader)
    }
    if (chunkId === 0x0309200f) {
        let ghostLogin = reader.readString()
        console.log({ ghostLogin })
    }
    if (chunkId === 0x0309200f) {
        let ignored = reader.readLookbackString()
        console.log({ ignored })
        skipToNextChunk(reader)
    }
    if (chunkId === 0x03092010) {
        let ignored = reader.readLookbackString()
        console.log({ ignored })
        skipToNextChunk(reader)
    }
}