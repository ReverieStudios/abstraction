<script lang="ts">
	import * as AssetOperations from '$lib/importExports/assets';
	import * as TreeOperations from '$lib/importExports/decisionTree';
	import Button from '$lib/ui/Button.svelte';
	import { page } from '$app/stores';
	import { sortBy, transform } from 'lodash-es';
	import { utils, writeFile as xlsxWrite, read as xlsxRead } from 'xlsx';
	import { database } from '$lib/database';

	const { gameID } = $page.params;

	const assets = database.assets;
	const assetTypes = database.assetTypes;
	const decisionTree = database.decisionTree;

	$: data = {
		assets: $assets,
		assetTypes: $assetTypes,
		decisionTree: $decisionTree
	};

	const operations = [AssetOperations, TreeOperations];

	const doExport = () => {
		const sheets = sortBy(
			operations.flatMap((op) => op.exportToSheet(data)),
			'label'
		);

		const workbook = utils.book_new();
		sheets.forEach(({ worksheet, label }) => {
			utils.book_append_sheet(workbook, worksheet, label);
		});
		xlsxWrite(workbook, `${gameID}.xlsx`);
	};

	const readImportFile = (e: Event) => {
		const fileList = (e.target as HTMLInputElement).files;
		if (fileList.length === 1) {
			const reader = new FileReader();
			reader.addEventListener('load', (event) => {
				const workbook = xlsxRead(event.target.result);

				const sheetData = transform(
					workbook.SheetNames,
					(acc, name) => {
						acc[name] = utils.sheet_to_json(workbook.Sheets[name], {
							header: 1,
							blankrows: false
						});
					},
					{}
				);

				const output = operations.flatMap((op) => {
					const sheetNames: string[] = workbook.SheetNames.filter(op.isSheet);
					return sheetNames.map((name) => op.importFromSheet(data, sheetData[name], name));
				});
				console.log(output);
			});
			reader.readAsArrayBuffer(fileList[0]);
		}
	};
</script>

<Button class="fill h2 my3 py3" type="button" on:click={doExport}>Export</Button>

<div class="fill h2 my3 py3 mdc-button mdc-button--unelevated">
	<div class="mdc-button__ripple" />
	Import
	<input type="file" accept=".xlsx,.xls" on:change={readImportFile} />
</div>

<style>
	input[type='file'] {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		font-size: 5em;
		opacity: 0;
	}
</style>
