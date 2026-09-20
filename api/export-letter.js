function clean(value) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g," ").replace(/[ \t]+/g," ").trim();
}

function safeFilename(value) {
  return clean(value || "Cover-Letter").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").slice(0,100);
}

async function makeDocx(letter) {
  const docx = await import("docx");
  const {Document,Packer,Paragraph,TextRun,AlignmentType} = docx;
  const children = [];

  if (clean(letter.candidateName)) {
    children.push(new Paragraph({
      alignment:AlignmentType.CENTER,
      spacing:{after:60},
      children:[new TextRun({text:clean(letter.candidateName),font:"Arial",size:28,bold:true})]
    }));
  }

  const contact=[clean(letter.candidateEmail),clean(letter.candidatePhone)].filter(Boolean).join(" | ");
  if (contact) {
    children.push(new Paragraph({
      alignment:AlignmentType.CENTER,
      spacing:{after:180},
      children:[new TextRun({text:contact,font:"Arial",size:18})]
    }));
  }

  const paragraphs=String(letter.text || "").split(/\n{2,}/).map(function(p){return p.trim();}).filter(Boolean);
  paragraphs.forEach(function(text){
    children.push(new Paragraph({
      spacing:{after:140,line:276},
      children:[new TextRun({text:clean(text),font:"Arial",size:22})]
    }));
  });

  const doc=new Document({
    creator:"Deep Nexivra",
    title:(clean(letter.targetRole) || "Application") + " Cover Letter",
    sections:[{
      properties:{page:{margin:{top:720,right:720,bottom:720,left:720}}},
      children
    }]
  });
  return Packer.toBuffer(doc);
}

async function makePdf(letter) {
  const {jsPDF}=await import("jspdf");
  const doc=new jsPDF({unit:"pt",format:"letter",orientation:"portrait"});
  const pageWidth=doc.internal.pageSize.getWidth();
  const pageHeight=doc.internal.pageSize.getHeight();
  const margin=54;
  const width=pageWidth-margin*2;
  let y=54;

  function ensure(height){
    if(y+height>pageHeight-54){doc.addPage();y=54;}
  }
  function draw(text,size,bold,after,align){
    const lines=doc.splitTextToSize(clean(text),width);
    const lineHeight=size*1.45;
    ensure(lines.length*lineHeight+(after||0));
    doc.setFont("helvetica",bold?"bold":"normal");
    doc.setFontSize(size);
    doc.text(lines,align==="center"?pageWidth/2:margin,y,{align:align||"left"});
    y+=lines.length*lineHeight+(after||0);
  }

  if(clean(letter.candidateName)) draw(letter.candidateName,15,true,4,"center");
  const contact=[clean(letter.candidateEmail),clean(letter.candidatePhone)].filter(Boolean).join(" | ");
  if(contact) draw(contact,8.5,false,20,"center");

  String(letter.text || "").split(/\n{2,}/).map(function(p){return p.trim();}).filter(Boolean).forEach(function(p){
    draw(p,10.5,false,14,"left");
  });

  return Buffer.from(doc.output("arraybuffer"));
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({ok:false,message:"Method not allowed"});
  const body=req.body||{};
  const format=body.format;
  const letter=body.letter||{};
  if(format!=="docx"&&format!=="pdf") return res.status(400).json({ok:false,message:"Format must be docx or pdf"});
  if(!clean(letter.text)) return res.status(400).json({ok:false,message:"Cover letter text is required"});

  try{
    const buffer=format==="docx"?await makeDocx(letter):await makePdf(letter);
    const mime=format==="docx"
      ?"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      :"application/pdf";
    res.setHeader("Content-Type",mime);
    res.setHeader("Content-Disposition",'attachment; filename="'+safeFilename((letter.targetRole||"Application")+"-Cover-Letter")+"."+format+'"');
    res.setHeader("Cache-Control","no-store");
    return res.status(200).send(buffer);
  }catch(error){
    return res.status(500).json({ok:false,message:"Unable to export cover letter"});
  }
}
