#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { existsSync } from "https://deno.land/std@0.224.0/fs/exists.ts";

import { readAll } from "https://deno.land/std@0.182.0/streams/read_all.ts";
const slurp_stdin = _ => readAll(Deno.stdin).then(b => new TextDecoder().decode(b))

const j = JSON.parse(await slurp_stdin())

const ri = html => ({ t: 'RawInline', c: ['html', html] })
const str = str => ({ t: 'Str', c: str })

const img_counts = {}

let curr_timezone = "ERROR!"

const CONVERT_MAP =
	{ jpg: "webp"
	, mp4: "webm"
	}
const CONVERT_PLZ = path => {
	const [,name, ext] = path.match(/\/(\w+)\.(\w+)$/)
	const output = `media/${name}.${CONVERT_MAP[ext]}`

	if (existsSync(output)) {
		console.error(`${output} already exists`)
		return output
	} else {
		console.error("CONVERT")
		if (ext === 'mp4') {
			const cmd = new Deno.Command("ffmpeg", { args: ["-i", path, output] })
			console.error(cmd.outputSync())
		} else {

			const cmd = new Deno.Command("convert", { args: [path, "-auto-orient", output] })
			console.error(cmd.outputSync())
		}
		return output
	}
}

const time = timeZone => date =>
	date.toLocaleTimeString("ja-JP", { timeZone, timeZoneName: "shortOffset", hour: '2-digit', minute: '2-digit' })

const handlers = {
	Link: ({ tree: { c }, currHead }) => {
		const [_, [...basething], [explain]] = c

		// console.error(c)

		return { needFlat: true, currHead, tree: [ ri('<ruby>'), ...basething, ri('<rt>'), str(decodeURIComponent(explain)), ri('</rt>'), ri('</ruby>') ]}
	}

	, Str: ({ tree, currHead }) => tree.c === '->'
		? ({ tree: str('→'), currHead })
		: ({ tree, currHead })

	, Header: ({ tree, currHead }) => {
		const level = tree.c[0] // :)
		const id = tree.c[1][0]

		if (level == 2) return { tree, currHead: id }
		else return { tree, currHead }
	}
	, Image: ({ currHead, tree }) => {
		img_counts[currHead] ??= 0
		img_counts[currHead] += 1
		// console.error(tree)
		const { t, c: [a, b, [_href, y]]} = tree
		// console.error({ tree: {t, c: [a, b, [x.replace(/^pics\/(.+)\.jpg$/, 'media/$1.webp'), y]]}, currHead })
		// const adjusted_filename = x
		// 	.replace(/^pics\/(.+)\.(jpg|png|webp)$/, 'media/$1.webp')
		// 	.replace(/^pics\/(.+\.webm)/, 'media/$1')

		let m
		if (m = _href.match(/^TZ=([\w\/]+):(.+)$/)) {
			curr_timezone = m[1]
		}
		const _filename = m
			? m[2]
			: _href

		const filename = `../TEMPPHOTOS/${_filename}`

		// console.error(b)
		console.error(_href)
		console.error(m)

		console.error(time(curr_timezone)(Deno.statSync(filename).mtime))



		const updated_caption = [str(`${time(curr_timezone)(Deno.statSync(filename).mtime)}: `), ...b]

		// return {tree, currHead}
		return { tree: {t, c: [a, updated_caption, [CONVERT_PLZ(filename), y]]}, currHead }
	}
}

const allt = new Set()

const hehe = x => {

	let { tree, currHead } = x

	if (typeof(tree) !== 'object') {
		return { tree, currHead }
	}

	if (Array.isArray(tree)) {
		const res = []
		for (const t of tree) {
			const { tree: tres, needFlat, currHead: newhead } = hehe({ tree: t, currHead })
			currHead = newhead
			if (needFlat)
				res.push(...tres)
			else
				res.push(tres)
		}
		return { tree: res, currHead }
	}

	// console.error(tree)

	const { t, c } = tree

	allt.add(t)

	// const h = handlers[t]
	// if (h) {
	// 	tree = h(x)
	// 	console.error('changed', tree)
	// }

	let recurse = null

	if (c) {
		const { tree: res, currHead: resHead } = hehe({ tree: c, currHead })
		recurse =  { tree: { t, c: res }, currHead: resHead }
	} else {
		recurse =  { tree, currHead }
	}

	const h = handlers[t]
	return h ? h(recurse) : recurse
}

// await Deno.writeTextFile('out.json', JSON.stringify(j, null, '\t'))


// console.error(j.blocks.map(tree => hehe({ tree, currHead: 'idk' })))

// j.blocks = j.blocks.map(transform)
// j.blocks = j.blocks.map(tree => hehe({ tree, currHead: 'idk' })).map(({tree}) => tree)

j.blocks = hehe({ tree: j.blocks, currHead: 'hehehh' }).tree

// console.error(hehe({tree: j.blocks[0]}))

console.error(allt)

// await Deno.writeTextFile('transf.json', new Date() + JSON.stringify(j, null, '\t'))

const IFILE = 'img_counts.json'

try {
	const counts = JSON.parse(await Deno.readTextFile(IFILE))
	await Deno.writeTextFile(IFILE, JSON.stringify({...counts, ...img_counts},null,'\t'))
} catch (_) {
	await Deno.writeTextFile(IFILE, JSON.stringify(img_counts,null,'\t'))
}

// console.error(img_counts)
// console.error(Object.values(img_counts).reduce((a, b) => a+b, 0))

console.log(JSON.stringify(j))